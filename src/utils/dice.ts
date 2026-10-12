import {
  DiceRollResult,
  DieType,
  RollTypeCategory,
  RollVisibility,
  RollDisplayMode,
  DieGroupRoll,
  PairedD20Roll,
  RollInstance,
  RollRiderDie,
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

  if (poolEntries.length === 0) {
    poolEntries.push({ diceType: 'd20', count: 1 });
  }

  // D20 PRESENCE CHECK:
  // Inspect whether the pool contains any d20
  const d20Entry = poolEntries.find((p) => p.diceType === 'd20');
  const d20Count = d20Entry ? d20Entry.count : 0;
  const isD20Present = d20Count > 0;

  const allResolvedRolls: number[] = [];
  const allRawRolls: number[] = [];
  const allPairedRolls: PairedD20Roll[] = [];
  const allIndividualLineItems: string[] = [];
  const poolBreakdown: DieGroupRoll[] = [];
  let instances: RollInstance[] | undefined = undefined;

  let hasCrit = false;
  let hasFumble = false;
  let total = 0;

  if (!isD20Present) {
    // -------------------------------------------------------------
    // CASE 1: Pure Damage / Tables / Spells (No d20 present)
    // -------------------------------------------------------------
    // Evaluate as a single flat pool: roll all dice, add flat modifier, display direct sum.
    let sumOfAllDice = 0;
    let totalDiceCount = 0;

    poolEntries.forEach((entry) => {
      const sides = DIE_SIDES[entry.diceType] || 6;
      const groupRolls: number[] = [];
      totalDiceCount += entry.count;

      for (let i = 0; i < entry.count; i++) {
        const val = rollSingleDie(sides);
        groupRolls.push(val);
        allRawRolls.push(val);
        allResolvedRolls.push(val);
      }

      const groupSum = groupRolls.reduce((acc, curr) => acc + curr, 0);
      sumOfAllDice += groupSum;

      allIndividualLineItems.push(`${entry.count}${entry.diceType}: [${groupRolls.join(', ')}]`);

      poolBreakdown.push({
        dieType: entry.diceType,
        rolls: groupRolls,
        rawRolls: groupRolls,
      });
    });

    const grandTotal = sumOfAllDice + modifier;

    if (displayMode === 'sum') {
      total = grandTotal;
      if (modifier !== 0) {
        allIndividualLineItems.push(`Modifier: ${modifier > 0 ? `+${modifier}` : modifier}`);
      }
      allIndividualLineItems.push(`Total: ${grandTotal}`);
    } else {
      // Indiv mode
      total = 0;
    }

    // Pure damage: play standard dice roll sound
    playDiceRollSound();

    // Construct formula
    const formulaParts = poolEntries.map((e) => `${e.count}${e.diceType}`);
    let formula = formulaParts.join(' + ');
    if (modifier !== 0) {
      formula += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
    }

    const isActuallySecret = visibility === 'dm' || visibility === 'gm_only' || isSecret;

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
      diceType: poolEntries[0]?.diceType || 'd6',
      count: totalDiceCount,
      modifier,
      rolls: allResolvedRolls,
      breakdown: allIndividualLineItems,
      rawRolls: allRawRolls,
      total,
      advantageMode,
      label: label.trim() || undefined,
      isCrit: false,
      isFumble: false,
      displayMode,
      poolBreakdown,
      formula,
      individualSummary: allIndividualLineItems.join(' | '),
      individualLineItems: allIndividualLineItems,
    };
  }

  // -------------------------------------------------------------
  // CASE 2: Attack / Action Batches (When N x d20 is present)
  // -------------------------------------------------------------
  // The count of d20s (N) defines the number of Independent Instances.
  // All other dice (d4, d6, d8, d10, d12, d100) and flat modifier constitute the Payload.
  const payloadDice = poolEntries.filter((p) => p.diceType !== 'd20');
  const instanceList: RollInstance[] = [];

  for (let i = 1; i <= d20Count; i++) {
    let chosenD20: number;
    let discardedD20: number | undefined = undefined;

    if (advantageMode === 'normal') {
      const val = rollSingleDie(20);
      chosenD20 = val;
      allRawRolls.push(val);
      allResolvedRolls.push(val);
    } else if (advantageMode === 'advantage') {
      const valA = rollSingleDie(20);
      const valB = rollSingleDie(20);
      chosenD20 = Math.max(valA, valB);
      discardedD20 = Math.min(valA, valB);
      allRawRolls.push(valA, valB);
      allResolvedRolls.push(chosenD20);

      allPairedRolls.push({
        pairIndex: i,
        die1: valA,
        die2: valB,
        selected: chosenD20,
        discarded: discardedD20,
        modifier,
        totalWithModifier: chosenD20 + modifier,
        lineItem: `Roll ${i}: [${chosenD20}, ~~${discardedD20}~~]`,
      });
    } else {
      // Disadvantage
      const valA = rollSingleDie(20);
      const valB = rollSingleDie(20);
      chosenD20 = Math.min(valA, valB);
      discardedD20 = Math.max(valA, valB);
      allRawRolls.push(valA, valB);
      allResolvedRolls.push(chosenD20);

      allPairedRolls.push({
        pairIndex: i,
        die1: valA,
        die2: valB,
        selected: chosenD20,
        discarded: discardedD20,
        modifier,
        totalWithModifier: chosenD20 + modifier,
        lineItem: `Roll ${i}: [${chosenD20}, ~~${discardedD20}~~]`,
      });
    }

    // Crit / Fumble Detection
    const instCrit = chosenD20 === 20;
    const instFumble = chosenD20 === 1;
    if (instCrit) hasCrit = true;
    if (instFumble) hasFumble = true;

    // Independent Rider Rolling per instance
    const instRiders: RollRiderDie[] = [];
    let riderSum = 0;

    payloadDice.forEach((p) => {
      const sides = DIE_SIDES[p.diceType] || 6;
      const groupRolls: number[] = [];
      for (let k = 0; k < p.count; k++) {
        const val = rollSingleDie(sides);
        groupRolls.push(val);
        allRawRolls.push(val);
        allResolvedRolls.push(val);
      }
      const sum = groupRolls.reduce((a, b) => a + b, 0);
      riderSum += sum;
      instRiders.push({
        diceType: p.diceType,
        count: p.count,
        rolls: groupRolls,
        sum,
      });
    });

    // Instance Total: InstanceTotal = chosenD20 + sum(instanceRiders) + modifier
    const instanceTotal = chosenD20 + riderSum + modifier;

    // Text representation for instance
    const d20BadgeText =
      discardedD20 !== undefined
        ? `[${chosenD20}, ~~${discardedD20}~~]`
        : `[${chosenD20}]`;
    const riderText = instRiders
      .map((r) => `+ ${r.count}${r.diceType}[${r.rolls.join(', ')}]`)
      .join(' ');
    const modText =
      modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
    const rawLine = `Roll ${i}: ${d20BadgeText}${riderText ? ` ${riderText}` : ''}${modText} = ${instanceTotal}`;

    allIndividualLineItems.push(rawLine);

    instanceList.push({
      index: i,
      d20Chosen: chosenD20,
      d20Discarded: discardedD20,
      isCrit: instCrit,
      isFumble: instFumble,
      riders: instRiders,
      modifier,
      total: instanceTotal,
      rawText: rawLine,
    });
  }

  instances = instanceList;

  // Add d20 group to pool breakdown
  poolBreakdown.push({
    dieType: 'd20',
    rolls: instanceList.map((inst) => inst.d20Chosen),
    pairedRolls: allPairedRolls.length > 0 ? allPairedRolls : undefined,
    rawRolls: allRawRolls,
  });

  // Add payload dice to pool breakdown
  payloadDice.forEach((p) => {
    const allRiderRollsForDieType: number[] = [];
    instanceList.forEach((inst) => {
      const match = inst.riders.find((r) => r.diceType === p.diceType);
      if (match) allRiderRollsForDieType.push(...match.rolls);
    });
    poolBreakdown.push({
      dieType: p.diceType,
      rolls: allRiderRollsForDieType,
      rawRolls: allRiderRollsForDieType,
    });
  });

  // GRAND TOTAL CALCULATION:
  // Grand Total equals the exact sum of all instance totals
  const grandTotal = instanceList.reduce((acc, curr) => acc + curr.total, 0);

  if (displayMode === 'sum') {
    total = grandTotal;
    allIndividualLineItems.push(`Combined Total: ${grandTotal}`);
  } else {
    // Indiv Mode: grand totals are NOT aggregated or shown in header
    total = 0;
  }

  // Construct readable formula string (e.g. "2d20 (Advantage) + 1d8 + 1d6 + 5")
  const d20Formula = `${d20Count}d20${
    advantageMode !== 'normal'
      ? ` (${advantageMode === 'advantage' ? 'Advantage' : 'Disadvantage'})`
      : ''
  }`;
  const payloadFormula = payloadDice.map((p) => `${p.count}${p.diceType}`).join(' + ');
  let formula = [d20Formula, payloadFormula].filter(Boolean).join(' + ');
  if (modifier !== 0) {
    formula += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  }

  // Audio feedback
  if (hasCrit) {
    playCritSound();
  } else if (hasFumble && !hasCrit) {
    playFumbleSound();
  } else {
    playDiceRollSound();
  }

  const isActuallySecret = visibility === 'dm' || visibility === 'gm_only' || isSecret;
  const individualSummary = instanceList.map((inst) => inst.total).join(', ');

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
    diceType: 'd20',
    count: d20Count + payloadDice.reduce((acc, curr) => acc + curr.count, 0),
    modifier,
    rolls: allResolvedRolls,
    breakdown: allIndividualLineItems,
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
    instances,
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

  // Extract trailing modifiers if present (e.g. +4 or -2)
  const remainder = cleaned.replace(/(\d*)d(4|6|8|10|12|20|100)/g, '');
  let modifier = 0;
  if (remainder) {
    const modMatches = remainder.match(/[+-]?\d+/g);
    if (modMatches) {
      modifier = modMatches.reduce((acc, curr) => acc + parseInt(curr, 10), 0);
    }
  }

  if (pool.length === 0 && modifier === 0) return null;

  return {
    count: totalCount,
    diceType: primaryDie,
    modifier,
    pool: pool.length > 0 ? pool : [{ diceType: 'd20', count: 1 }],
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
