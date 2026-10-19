/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

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
} from '../../types/ttrpg';
import { playCritSound, playDiceRollSound, playFumbleSound } from '../../utils/audio';

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
  macroName?: string;
}

/**
 * Normalized Dice Engine ("What You Type Is What Rolls")
 * Zero implicit dice-cloning loops.
 * 
 * 1. [ 🎲 ROLL SUM ] Mode:
 *    Intended for Skill Challenges (e.g. party pooling 5d20 + 1d4 + 15), damage pools, and healing.
 *    Evaluates all dice in the expression once and sums them into a single aggregate total.
 *    Example: 5d20 [18, 12, 16, 9, 14] + 1d4 [3] + 15 = 104
 * 
 * 2. [ 📊 ROLL INDIV ] Mode:
 *    Intended for multi-attacks and mob checks (e.g. 5d20 + 5).
 *    Rolls N individual d20s, applies flat modifier to EACH d20 roll individually.
 *    Example: Attack Batch -> Roll 1: [18] + 5 = 23, Roll 2: [12] + 5 = 17...
 *    If no d20 present (e.g. 4d6), rolls the dice and displays individual faces without summing.
 */
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
  macroName,
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

  // Normalize pool entries from provided pool or single die configuration
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

  const d20Entry = poolEntries.find((p) => p.diceType === 'd20');
  const d20Count = d20Entry ? d20Entry.count : 0;
  const isD20Present = d20Count > 0;
  const isActuallySecret = visibility === 'dm' || visibility === 'gm_only' || isSecret;

  // -------------------------------------------------------------------------
  // MODE 1: [ 🎲 ROLL SUM ] Execution (Grand Totals & Skill Challenges)
  // -------------------------------------------------------------------------
  // Evaluates all dice in the expression exactly once.
  // Every die and modifier entered in the formula is rolled exactly as typed. Zero implicit cloning.
  if (displayMode === 'sum') {
    const allResolvedRolls: number[] = [];
    const allRawRolls: number[] = [];
    const poolBreakdown: DieGroupRoll[] = [];
    const breakdownSegments: string[] = [];
    let hasCrit = false;
    let hasFumble = false;
    let totalDiceCount = 0;

    poolEntries.forEach((entry) => {
      const sides = DIE_SIDES[entry.diceType] || 20;
      const groupRolls: number[] = [];
      totalDiceCount += entry.count;

      for (let i = 0; i < entry.count; i++) {
        if (entry.diceType === 'd20' && advantageMode !== 'normal') {
          const valA = rollSingleDie(20);
          const valB = rollSingleDie(20);
          allRawRolls.push(valA, valB);
          const isAdv = advantageMode === 'advantage';
          const chosen = isAdv ? Math.max(valA, valB) : Math.min(valA, valB);
          groupRolls.push(chosen);
          allResolvedRolls.push(chosen);
          if (chosen === 20) hasCrit = true;
          if (chosen === 1) hasFumble = true;
        } else {
          const val = rollSingleDie(sides);
          groupRolls.push(val);
          allRawRolls.push(val);
          allResolvedRolls.push(val);
          if (entry.diceType === 'd20') {
            if (val === 20) hasCrit = true;
            if (val === 1) hasFumble = true;
          }
        }
      }

      poolBreakdown.push({
        dieType: entry.diceType,
        rolls: groupRolls,
        rawRolls: groupRolls,
      });

      breakdownSegments.push(`${entry.count}${entry.diceType} [${groupRolls.join(', ')}]`);
    });

    const sumOfAllDice = allResolvedRolls.reduce((acc, curr) => acc + curr, 0);
    const grandTotal = sumOfAllDice + modifier;

    const modText = modifier !== 0 ? (modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`) : '';
    const breakdownLine = `${breakdownSegments.join(' + ')}${modText} = ${grandTotal}`;

    // Construct clean formula string
    const formulaParts = poolEntries.map((e) => {
      if (e.diceType === 'd20' && advantageMode !== 'normal') {
        return `${e.count}d20 (${advantageMode === 'advantage' ? 'Adv' : 'Dis'})`;
      }
      return `${e.count}${e.diceType}`;
    });
    let formula = formulaParts.join(' + ');
    if (modifier !== 0) {
      formula += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
    }

    if (hasCrit) {
      playCritSound();
    } else if (hasFumble && !hasCrit) {
      playFumbleSound();
    } else {
      playDiceRollSound();
    }

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
      diceType: poolEntries[0]?.diceType || 'd20',
      count: totalDiceCount,
      modifier,
      rolls: allResolvedRolls,
      breakdown: [breakdownLine],
      rawRolls: allRawRolls,
      total: grandTotal,
      advantageMode,
      label: label.trim() || undefined,
      isCrit: hasCrit,
      isFumble: hasFumble && !hasCrit,
      displayMode: 'sum',
      poolBreakdown,
      formula,
      individualSummary: grandTotal.toString(),
      individualLineItems: [breakdownLine],
      macroName,
    };
  }

  // -------------------------------------------------------------------------
  // MODE 2: [ 📊 ROLL INDIV ] Execution (Attacks & Contested Checks)
  // -------------------------------------------------------------------------
  // If formula contains Nd20:
  // Rolls N individual d20s, applies flat modifier to EACH d20 roll individually.
  // Feeds output as a batch of distinct results (Roll 1, Roll 2, ...).
  if (isD20Present) {
    const allResolvedRolls: number[] = [];
    const allRawRolls: number[] = [];
    const allPairedRolls: PairedD20Roll[] = [];
    const allIndividualLineItems: string[] = [];
    const poolBreakdown: DieGroupRoll[] = [];
    const instanceList: RollInstance[] = [];

    let hasCrit = false;
    let hasFumble = false;

    // Separate non-d20 auxiliary dice (e.g. 1d8 damage rider on an attack)
    // Distributed evenly across the N attacks without multiplication/cloning!
    const auxiliaryEntries = poolEntries.filter((p) => p.diceType !== 'd20');

    // Pre-roll auxiliary dice exactly as typed once
    const rolledAuxiliaryDice: { diceType: DieType; value: number }[] = [];
    auxiliaryEntries.forEach((aux) => {
      const sides = DIE_SIDES[aux.diceType] || 6;
      for (let k = 0; k < aux.count; k++) {
        const val = rollSingleDie(sides);
        rolledAuxiliaryDice.push({ diceType: aux.diceType, value: val });
        allRawRolls.push(val);
        allResolvedRolls.push(val);
      }
    });

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

      const instCrit = chosenD20 === 20;
      const instFumble = chosenD20 === 1;
      if (instCrit) hasCrit = true;
      if (instFumble) hasFumble = true;

      // Assign auxiliary rider dice to this attack instance (1-to-1 mapping, zero cloning)
      const instRiders: RollRiderDie[] = [];
      let riderSum = 0;

      if (rolledAuxiliaryDice.length > 0) {
        // If single d20, assign all auxiliary dice
        // If multiple d20s, assign auxiliary dice matching index or distributed
        const assignedDice =
          d20Count === 1
            ? rolledAuxiliaryDice
            : rolledAuxiliaryDice.filter((_, idx) => idx % d20Count === i - 1);

        // Group by die type
        const grouped = new Map<DieType, number[]>();
        assignedDice.forEach((d) => {
          if (!grouped.has(d.diceType)) grouped.set(d.diceType, []);
          grouped.get(d.diceType)!.push(d.value);
        });

        grouped.forEach((vals, dType) => {
          const sum = vals.reduce((a, b) => a + b, 0);
          riderSum += sum;
          instRiders.push({
            diceType: dType,
            count: vals.length,
            rolls: vals,
            sum,
          });
        });
      }

      // Flat modifier applied to each individual attack roll
      const instanceTotal = chosenD20 + riderSum + modifier;

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

    poolBreakdown.push({
      dieType: 'd20',
      rolls: instanceList.map((inst) => inst.d20Chosen),
      pairedRolls: allPairedRolls.length > 0 ? allPairedRolls : undefined,
      rawRolls: allRawRolls,
    });

    const d20Formula = `${d20Count}d20${
      advantageMode !== 'normal'
        ? ` (${advantageMode === 'advantage' ? 'Adv' : 'Dis'})`
        : ''
    }`;
    const auxFormula = auxiliaryEntries.map((p) => `${p.count}${p.diceType}`).join(' + ');
    let formula = [d20Formula, auxFormula].filter(Boolean).join(' + ');
    if (modifier !== 0) {
      formula += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
    }

    if (hasCrit) {
      playCritSound();
    } else if (hasFumble && !hasCrit) {
      playFumbleSound();
    } else {
      playDiceRollSound();
    }

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
      count: d20Count + auxiliaryEntries.reduce((acc, curr) => acc + curr.count, 0),
      modifier,
      rolls: allResolvedRolls,
      breakdown: allIndividualLineItems,
      rawRolls: allRawRolls,
      pairedRolls: allPairedRolls.length > 0 ? allPairedRolls : undefined,
      total: 0, // Individual mode does not sum
      advantageMode,
      label: label.trim() || undefined,
      isCrit: hasCrit,
      isFumble: hasFumble && !hasCrit,
      displayMode: 'individual',
      poolBreakdown,
      formula,
      individualSummary,
      individualLineItems: allIndividualLineItems,
      instances: instanceList,
      macroName,
    };
  }

  // -------------------------------------------------------------------------
  // MODE 3: [ 📊 ROLL INDIV ] Without D20 (e.g. 4d6)
  // -------------------------------------------------------------------------
  // Rolls the dice and displays each individual die face without summing.
  const allResolvedRolls: number[] = [];
  const allRawRolls: number[] = [];
  const allIndividualLineItems: string[] = [];
  const poolBreakdown: DieGroupRoll[] = [];
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

    allIndividualLineItems.push(`${entry.count}${entry.diceType}: [${groupRolls.join(', ')}]`);

    poolBreakdown.push({
      dieType: entry.diceType,
      rolls: groupRolls,
      rawRolls: groupRolls,
    });
  });

  const formulaParts = poolEntries.map((e) => `${e.count}${e.diceType}`);
  let formula = formulaParts.join(' + ');
  if (modifier !== 0) {
    formula += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
  }

  playDiceRollSound();

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
    total: 0,
    advantageMode,
    label: label.trim() || undefined,
    isCrit: false,
    isFumble: false,
    displayMode: 'individual',
    poolBreakdown,
    formula,
    individualSummary: allResolvedRolls.join(', '),
    individualLineItems: allIndividualLineItems,
    macroName,
  };
}

/**
 * Universal Formula Parser
 * Correctly parses mixed expressions like 5d20+1d4+15, 2d6+3, 8d6, 1d20-2
 */
export function parseDiceFormula(formula: string): {
  count: number;
  diceType: DieType;
  modifier: number;
  pool?: DicePoolEntry[];
} | null {
  const cleaned = formula.replace(/\s+/g, '').toLowerCase();
  if (!cleaned) return null;

  // Single die formula: 2d6+3, 1d20, 8d6
  const singleMatch = cleaned.match(/^(\d*)d(4|6|8|10|12|20|100)([+-]\d+)?$/);
  if (singleMatch) {
    const count = singleMatch[1] ? parseInt(singleMatch[1], 10) : 1;
    const diceType = (`d${singleMatch[2]}`) as DieType;
    const modifier = singleMatch[3] ? parseInt(singleMatch[3], 10) : 0;
    return { count, diceType, modifier, pool: [{ diceType, count }] };
  }

  // Mixed dice pool formula: 5d20 + 1d4 + 15, 2d6 + 1d8 - 2
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

  // Extract flat modifiers
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

export function parseMacroFormula(formula: string): {
  count: number;
  sides: number;
  modifier: number;
  dieType: DieType;
} | null {
  if (!formula) return null;
  const cleaned = formula.trim();
  const match = cleaned.match(/^(\d+)d(\d+)(?:\s*([+-])\s*(\d+))?$/i);
  if (!match) return null;

  const count = parseInt(match[1], 10);
  const sides = parseInt(match[2], 10);
  const sign = match[3];
  const modVal = match[4] ? parseInt(match[4], 10) : 0;
  const modifier = sign === '-' ? -modVal : modVal;
  const dieType = `d${sides}` as DieType;

  return {
    count,
    sides,
    modifier,
    dieType,
  };
}
