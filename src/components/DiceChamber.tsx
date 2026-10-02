import React, { useState, useEffect } from 'react';
import {
  CustomMacro,
  DiceRollResult,
  DieType,
  RollTypeCategory,
  RollVisibility,
  RollDisplayMode,
} from '../types/ttrpg';
import { executeDiceRoll, parseDiceFormula } from '../utils/dice';
import { roomSync } from '../utils/roomSync';
import { liveFeedSync } from '../utils/liveFeedSync';
import {
  loadCustomMacros,
  addCustomMacro,
  deleteCustomMacro,
  resetCustomMacrosToDefault,
} from '../utils/macroStorage';
import {
  Dices,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Check,
  Zap,
  Lock,
  Globe,
  Swords,
  Shield,
  Flame,
  Compass,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  Layers,
} from 'lucide-react';

interface DiceChamberProps {
  isDm: boolean;
  playerName?: string;
}

const DIE_LIST: { type: DieType; label: string; sides: number; shape: string }[] = [
  { type: 'd4', label: 'd4', sides: 4, shape: '▲' },
  { type: 'd6', label: 'd6', sides: 6, shape: '■' },
  { type: 'd8', label: 'd8', sides: 8, shape: '◆' },
  { type: 'd10', label: 'd10', sides: 10, shape: '⬟' },
  { type: 'd12', label: 'd12', sides: 12, shape: '⬡' },
  { type: 'd20', label: 'd20', sides: 20, shape: '⬢' },
  { type: 'd100', label: 'd100', sides: 100, shape: '●' },
];

const ROLL_TYPE_CONFIG: {
  type: RollTypeCategory;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
  badgeClass: string;
  description: string;
  defaultDie?: DieType;
}[] = [
  {
    type: 'Straight roll',
    label: 'Straight roll',
    icon: Dices,
    activeClass: 'bg-slate-800 text-slate-100 border-slate-400 shadow-md ring-1 ring-slate-400/40',
    badgeClass: 'bg-slate-800/90 text-slate-200 border-slate-600',
    description: 'Standard neutral d20 or polyhedral roll',
    defaultDie: 'd20',
  },
  {
    type: 'Attack roll',
    label: 'Attack roll',
    icon: Swords,
    activeClass: 'bg-amber-950/90 text-amber-200 border-amber-400 shadow-md ring-1 ring-amber-400/50',
    badgeClass: 'bg-amber-950/80 text-amber-300 border-amber-600/70',
    description: 'Weapon attack, spell attack vs target AC',
    defaultDie: 'd20',
  },
  {
    type: 'Skill check',
    label: 'Skill check',
    icon: Sparkles,
    activeClass: 'bg-cyan-950/90 text-cyan-200 border-cyan-400 shadow-md ring-1 ring-cyan-400/50',
    badgeClass: 'bg-cyan-950/80 text-cyan-300 border-cyan-600/70',
    description: 'Ability & skill check (Perception, Stealth, etc.)',
    defaultDie: 'd20',
  },
  {
    type: 'Saving Throw',
    label: 'Saving Throw',
    icon: Shield,
    activeClass: 'bg-emerald-950/90 text-emerald-200 border-emerald-400 shadow-md ring-1 ring-emerald-400/50',
    badgeClass: 'bg-emerald-950/80 text-emerald-300 border-emerald-600/70',
    description: 'Defense against spells, traps, or hazards',
    defaultDie: 'd20',
  },
  {
    type: 'Damage',
    label: 'Damage',
    icon: Flame,
    activeClass: 'bg-rose-950/90 text-rose-200 border-rose-400 shadow-md ring-1 ring-rose-400/50',
    badgeClass: 'bg-rose-950/80 text-rose-300 border-rose-600/70',
    description: 'Damage dice (e.g. 1d8, 2d6, 8d6)',
    defaultDie: 'd8',
  },
  {
    type: 'Fate',
    label: 'Fate',
    icon: Compass,
    activeClass: 'bg-purple-950/90 text-purple-200 border-purple-400 shadow-md ring-1 ring-purple-400/50',
    badgeClass: 'bg-purple-950/80 text-purple-300 border-purple-600/70',
    description: 'Fate roll, luck check, DM oracle',
    defaultDie: 'd20',
  },
];

const DEFAULT_INITIAL_MACROS: CustomMacro[] = [
  { id: 'm-1', name: 'Attack (Longsword)', formula: '1d20+5', rollType: 'Attack roll' },
  { id: 'm-2', name: 'Damage (Longsword)', formula: '1d8+3', rollType: 'Damage' },
  { id: 'm-3', name: 'Sneak Attack', formula: '3d6', rollType: 'Damage' },
  { id: 'm-4', name: 'Fireball', formula: '8d6', rollType: 'Damage' },
  { id: 'm-5', name: 'Perception Check', formula: '1d20+3', rollType: 'Skill check' },
  { id: 'm-6', name: 'Fate Die', formula: '1d20', rollType: 'Fate' },
];

export const DiceChamber: React.FC<DiceChamberProps> = ({ isDm, playerName }) => {
  const [roomCode, setRoomCode] = useState<string>(() => roomSync.getRoomCode());
  const [userName, setUserName] = useState<string>(() => {
    return playerName?.trim() || roomSync.getPeerName();
  });
  const [diceHistory, setDiceHistory] = useState<DiceRollResult[]>(() => {
    // Populate directly from shared liveFeedSync history on initial render
    const feed = liveFeedSync.getFeed();
    const existingRolls: DiceRollResult[] = [];
    for (let i = feed.length - 1; i >= 0; i--) {
      const item = feed[i];
      if (item.type === 'dice' && item.rollDetails) {
        existingRolls.push({
          id: item.id,
          timestamp: item.timestamp,
          sender: item.sender,
          isDm: !!item.isDm,
          visibility: (item.rollDetails.visibility as RollVisibility) || 'public',
          rollType: (item.rollDetails.rollType as RollTypeCategory) || 'Straight roll',
          diceType: item.rollDetails.diceType || 'd20',
          count: item.rollDetails.count || 1,
          modifier: item.rollDetails.modifier || 0,
          rolls: item.rollDetails.rolls || [item.rollDetails.total],
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
          pairedRolls: item.rollDetails.pairedRolls,
          rawRolls: item.rollDetails.rawRolls,
        });
      }
    }
    return existingRolls.slice(0, 50);
  });
  
  // Selected Roll Type state (before dice selection)
  const [rollType, setRollType] = useState<RollTypeCategory>('Straight roll');
  
  // Mixed Dice Pool Builder State (e.g. 2d20 + 1d8 + 2d6)
  const [stagedPool, setStagedPool] = useState<Record<DieType, number>>({
    d4: 0,
    d6: 0,
    d8: 0,
    d10: 0,
    d12: 0,
    d20: 1,
    d100: 0,
  });

  // Roll evaluation display mode: 'sum' (Default) vs 'individual'
  const [displayMode, setDisplayMode] = useState<RollDisplayMode>('sum');
  const [modifier, setModifier] = useState<number>(0);
  const [advantageMode, setAdvantageMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [rollLabel, setRollLabel] = useState<string>('');
  
  // 3-way Roll Visibility toggle: public, dm, self
  const [visibility, setVisibility] = useState<RollVisibility>('public');
  
  const [customFormula, setCustomFormula] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [rollingAnimation, setRollingAnimation] = useState<boolean>(false);

  // Custom Macros State (Persisted in localStorage across reloads and future sessions)
  const [customMacros, setCustomMacros] = useState<CustomMacro[]>(() => {
    return loadCustomMacros();
  });

  // Modal / form state for adding a custom macro
  const [isAddingMacro, setIsAddingMacro] = useState<boolean>(false);
  const [newMacroName, setNewMacroName] = useState<string>('');
  const [newMacroFormula, setNewMacroFormula] = useState<string>('');
  const [newMacroType, setNewMacroType] = useState<RollTypeCategory>('Straight roll');
  const [macroError, setMacroError] = useState<string>('');

  useEffect(() => {
    // Subscribe to unified live feed so rolls made in Combat Tracker or by room peers sync here
    const unsubFeed = liveFeedSync.subscribe((items, newItem) => {
      // When feed is globally cleared, immediately wipe dice history too
      if (items.length === 0) {
        setDiceHistory([]);
        return;
      }

      if (newItem && newItem.type === 'dice' && newItem.rollDetails) {
        const rollObj: DiceRollResult = {
          id: newItem.id,
          timestamp: newItem.timestamp,
          sender: newItem.sender,
          isDm: !!newItem.isDm,
          visibility: (newItem.rollDetails.visibility as RollVisibility) || 'public',
          rollType: (newItem.rollDetails.rollType as RollTypeCategory) || 'Straight roll',
          diceType: newItem.rollDetails.diceType || 'd20',
          count: newItem.rollDetails.count || 1,
          modifier: newItem.rollDetails.modifier || 0,
          rolls: newItem.rollDetails.rolls || [newItem.rollDetails.total],
          total: newItem.rollDetails.total,
          advantageMode: newItem.rollDetails.advantageMode || 'normal',
          isCrit: newItem.rollDetails.isCrit,
          isFumble: newItem.rollDetails.isFumble,
          label: newItem.rollDetails.label,
          displayMode: newItem.rollDetails.displayMode || 'sum',
          poolBreakdown: newItem.rollDetails.poolBreakdown,
          formula: newItem.rollDetails.formula,
          individualSummary: newItem.rollDetails.individualSummary,
          individualLineItems: newItem.rollDetails.individualLineItems,
          pairedRolls: newItem.rollDetails.pairedRolls,
          rawRolls: newItem.rollDetails.rawRolls,
        };
        setDiceHistory((prev) => {
          if (prev.some((r) => r.id === rollObj.id)) return prev;
          return [rollObj, ...prev.slice(0, 49)];
        });
      }
    });

    return () => unsubFeed();
  }, []);

  // Synchronize roller displayName with incoming prop changes or roomSync presence updates
  useEffect(() => {
    const current = playerName?.trim() || roomSync.getPeerName();
    if (current && current !== userName) {
      setUserName(current);
    }
  }, [playerName]);

  useEffect(() => {
    const unsubPresence = roomSync.subscribePresence(() => {
      const current = roomSync.getPeerName();
      if (current && current !== userName) {
        setUserName(current);
      }
    });
    return () => unsubPresence();
  }, [userName]);

  const handleRollerNameChange = (newName: string) => {
    setUserName(newName);
    if (newName.trim()) {
      roomSync.configure(roomCode, newName.trim(), isDm);
    }
  };

  // Total dice count in currently staged pool
  const totalStagedDice = (Object.values(stagedPool) as number[]).reduce((a, b) => a + b, 0);

  // Mixed Pool Actions
  const handleAddDieToPool = (die: DieType) => {
    setStagedPool((prev) => ({
      ...prev,
      [die]: (prev[die] || 0) + 1,
    }));
  };

  const handleRemoveDieFromPool = (die: DieType) => {
    setStagedPool((prev) => ({
      ...prev,
      [die]: Math.max(0, (prev[die] || 0) - 1),
    }));
  };

  const handleClearDieFromPool = (die: DieType) => {
    setStagedPool((prev) => ({
      ...prev,
      [die]: 0,
    }));
  };

  const handleResetPool = () => {
    setStagedPool({
      d4: 0,
      d6: 0,
      d8: 0,
      d10: 0,
      d12: 0,
      d20: 0,
      d100: 0,
    });
  };

  const getStagedPoolEntries = (): { diceType: DieType; count: number }[] => {
    const list: { diceType: DieType; count: number }[] = [];
    (Object.entries(stagedPool) as [DieType, number][]).forEach(([d, count]) => {
      if (count > 0) list.push({ diceType: d, count });
    });
    return list;
  };

  // Formatted formula string of currently staged pool
  const stagedFormulaText = (() => {
    const entries = getStagedPoolEntries();
    if (entries.length === 0) return 'Empty Pool (click dice to add)';
    const parts = entries.map((e) => `${e.count}${e.diceType}`);
    let text = parts.join(' + ');
    if (modifier !== 0) {
      text += modifier > 0 ? ` + ${modifier}` : ` - ${Math.abs(modifier)}`;
    }
    return text;
  })();

  const handleSelectRollType = (type: RollTypeCategory) => {
    setRollType(type);
    const cfg = ROLL_TYPE_CONFIG.find((c) => c.type === type);
    if (cfg?.defaultDie && totalStagedDice === 0) {
      setStagedPool((prev) => ({ ...prev, [cfg.defaultDie!]: 1 }));
    }
  };

  const handleRoll = (
    poolOverride?: { diceType: DieType; count: number }[],
    mod: number = modifier,
    customType: RollTypeCategory = rollType,
    customLabel: string = rollLabel,
    customDisplayMode: RollDisplayMode = displayMode
  ) => {
    setRollingAnimation(true);
    setTimeout(() => setRollingAnimation(false), 400);

    const isSecretRoll = visibility === 'dm';
    const isSelfRoll = visibility === 'self';

    const poolToRoll = poolOverride || getStagedPoolEntries();
    // Default to 1d20 if pool is empty
    const finalPool = poolToRoll.length > 0 ? poolToRoll : [{ diceType: 'd20' as DieType, count: 1 }];

    const author = userName.trim() || roomSync.getPeerName();
    const result = executeDiceRoll({
      pool: finalPool,
      modifier: mod,
      advantageMode,
      displayMode: customDisplayMode,
      sender: author,
      isDm,
      isSecret: isSecretRoll,
      visibility,
      rollType: customType,
      label: customLabel,
    });

    // Add to local history
    setDiceHistory((prev) => [result, ...prev.slice(0, 49)]);

    // Record to unified feed (which also broadcasts to room peers if not a 'self' roll)
    liveFeedSync.recordDiceRoll(result, !isSelfRoll);

    setRollLabel('');
  };

  const handleCustomRoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFormula.trim()) return;

    const parsed = parseDiceFormula(customFormula);
    if (!parsed) {
      alert('Please enter a valid dice formula like 1d20+5, 2d6, or 2d20+1d8+2d6+4');
      return;
    }

    handleRoll(parsed.pool, parsed.modifier, rollType, `Formula: ${customFormula}`);
    setCustomFormula('');
  };

  // Roll a custom macro
  const handleRollCustomMacro = (macro: CustomMacro) => {
    const parsed = parseDiceFormula(macro.formula);
    if (!parsed) return;
    const typeToUse = macro.rollType || rollType;
    handleRoll(parsed.pool, parsed.modifier, typeToUse, macro.name);
  };

  // Add custom macro with persistent storage
  const handleCreateMacro = (e: React.FormEvent) => {
    e.preventDefault();
    setMacroError('');
    if (!newMacroName.trim()) {
      setMacroError('Macro name is required');
      return;
    }
    const parsed = parseDiceFormula(newMacroFormula);
    if (!parsed) {
      setMacroError('Formula invalid (e.g. 1d20+5, 2d6, 8d6-2)');
      return;
    }

    addCustomMacro(newMacroName, newMacroFormula, newMacroType);
    setCustomMacros(loadCustomMacros());
    setNewMacroName('');
    setNewMacroFormula('');
    setIsAddingMacro(false);
  };

  const handleDeleteMacro = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteCustomMacro(id);
    setCustomMacros(updated);
  };

  const handleResetMacros = () => {
    const defaults = resetCustomMacrosToDefault();
    setCustomMacros(defaults);
  };

  const handleCopyRoom = () => {
    navigator.clipboard?.writeText(roomCode);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Filter rolls based on player/DM view
  const visibleRolls = diceHistory.filter((roll) => {
    // If it's a self roll: only visible to the user who rolled it
    if (roll.visibility === 'self' && roll.sender !== userName) {
      return false;
    }
    return true;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Column: Dice Controls & Room Settings */}
      <div className="lg:col-span-7 space-y-6">
        {/* Room Header & Identity */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-medium block">
                Synchronized Dice Chamber
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-semibold text-slate-200">Room:</span>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  className="w-32 px-2 py-0.5 text-xs font-mono font-semibold rounded bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={handleCopyRoom}
                  title="Copy Room ID to share with players"
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Roller Name:</span>
            <input
              type="text"
              value={userName}
              onChange={(e) => handleRollerNameChange(e.target.value)}
              className="w-36 px-2.5 py-1 text-xs rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* PRIMARY DICE CONTROLS CARD */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-5 shadow-sm">
          
          {/* STEP 1: ROLL TYPE BUTTONS (Positioned Before Selecting Dice - FULL NAMES CLEARLY DISPLAYED) */}
          <div className="space-y-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider font-display flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Select Roll Type:
              </span>
              <span className="text-[11px] text-slate-400">Choose roll intent before rolling</span>
            </div>

            {/* Roll Type Toggle Buttons (Generous 3-column / 2-column grid so names are never cut off) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {ROLL_TYPE_CONFIG.map((cfg) => {
                const isSelected = rollType === cfg.type;
                const IconComponent = cfg.icon;
                return (
                  <button
                    key={cfg.type}
                    type="button"
                    onClick={() => handleSelectRollType(cfg.type)}
                    className={`flex items-center justify-start gap-2.5 px-3 py-2.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer text-left ${
                      isSelected
                        ? cfg.activeClass
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                    {/* Full un-truncated name with no clipping */}
                    <span className="whitespace-nowrap font-medium tracking-wide">
                      {cfg.label}
                    </span>
                  </button>
                );
              })}
            </div>
            
            <p className="text-[11px] text-slate-400 italic">
              Active mode: <strong className="text-amber-300 font-semibold">{rollType}</strong> · {ROLL_TYPE_CONFIG.find(c => c.type === rollType)?.description}
            </p>
          </div>

          {/* STEP 2: MIXED DICE POOL BUILDER & STAGED TRAY */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
                  Mixed Dice Pool Builder:
                </h3>
                <span className="text-[11px] font-mono text-amber-300 font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-700/60">
                  {totalStagedDice} {totalStagedDice === 1 ? 'die' : 'dice'} staged
                </span>
              </div>

              {/* Reset Pool Button */}
              <button
                type="button"
                onClick={handleResetPool}
                disabled={totalStagedDice === 0}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/70 text-rose-300 hover:text-white transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-sm"
                title="Instantly clear all staged dice from the pool"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Pool</span>
              </button>
            </div>

            {/* Polyhedral Clickable Dice Grid (Clicking stages +1 of that die) */}
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {DIE_LIST.map((die) => {
                const stagedCount = stagedPool[die.type] || 0;
                const isStaged = stagedCount > 0;
                return (
                  <button
                    key={die.type}
                    type="button"
                    onClick={() => handleAddDieToPool(die.type)}
                    className={`relative flex flex-col items-center justify-center p-3 rounded-xl border transition-all cursor-pointer group ${
                      isStaged
                        ? 'bg-amber-950/50 border-amber-400 text-amber-300 shadow-md ring-1 ring-amber-400/40'
                        : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                    title={`Click to add +1 ${die.label} to the staged pool`}
                  >
                    {isStaged && (
                      <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-amber-400 text-slate-950 font-bold font-mono text-[10px] flex items-center justify-center shadow">
                        {stagedCount}
                      </span>
                    )}
                    <span className="text-lg mb-0.5 group-hover:scale-110 transition-transform">
                      {die.shape}
                    </span>
                    <span className="text-xs font-bold font-mono">{die.label}</span>
                    <span className="text-[9px] text-slate-400 mt-0.5 opacity-80 group-hover:text-amber-300">
                      +1 {die.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Staged Pool Tray & Chips Display */}
            <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Currently Staged Pool:
                </span>
                <span className="font-mono text-xs font-bold text-amber-300 truncate max-w-[280px]">
                  {stagedFormulaText}
                </span>
              </div>

              {totalStagedDice === 0 ? (
                <div className="py-3 px-2 text-center text-xs text-slate-500 italic bg-slate-900/40 rounded-lg border border-dashed border-slate-800">
                  Pool is empty. Click any die above to build a multi-dice roll (e.g. click d20 twice, d8 once, d6 twice).
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {getStagedPoolEntries().map((entry) => (
                    <div
                      key={entry.diceType}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-amber-500/50 text-slate-200 text-xs shadow-sm"
                    >
                      <span className="font-mono font-bold text-amber-300 text-xs">
                        {entry.count}{entry.diceType}
                      </span>
                      <div className="flex items-center gap-0.5 ml-1 border-l border-slate-700 pl-1.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveDieFromPool(entry.diceType)}
                          className="w-4 h-4 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                          title="Decrease count"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddDieToPool(entry.diceType)}
                          className="w-4 h-4 rounded flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                          title="Increase count"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleClearDieFromPool(entry.diceType)}
                          className="w-4 h-4 rounded flex items-center justify-center text-slate-500 hover:text-rose-400 cursor-pointer ml-0.5"
                          title="Remove die from pool"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: MODIFIERS, ROLL DISPLAY TOGGLE (SUMMED VS INDIVIDUAL) & ADVANTAGE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Roll Display Mode Toggle: Summed vs. Individual */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400 font-medium">Roll Display Mode</label>
                <span className="text-[10px] text-amber-400 font-mono">
                  {displayMode === 'sum' ? 'Sum Total' : 'Individual'}
                </span>
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-700 rounded-lg">
                <button
                  type="button"
                  onClick={() => setDisplayMode('sum')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    displayMode === 'sum'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Sum Mode: Adds all rolled dice together with flat modifiers into a grand total"
                >
                  <span>∑ Sum Mode</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayMode('individual')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    displayMode === 'individual'
                      ? 'bg-amber-400 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Individual Mode: Displays each die result separately by die type without adding them together"
                >
                  <span>⚂ Individual</span>
                </button>
              </div>
            </div>

            {/* Flat Modifier Input */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Modifier (+/-)</label>
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setModifier(modifier - 1)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-l bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                >
                  -
                </button>
                <input
                  type="number"
                  value={modifier}
                  onChange={(e) => setModifier(parseInt(e.target.value, 10) || 0)}
                  className="w-full py-1.5 text-xs text-center bg-slate-950 border-y border-slate-700 text-slate-100 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setModifier(modifier + 1)}
                  className="px-2.5 py-1.5 text-xs font-semibold rounded-r bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
                >
                  +
                </button>
              </div>
            </div>

            {/* d20 Advantage / Disadvantage Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs text-slate-400 font-medium">d20 Advantage Mode</label>
                {advantageMode === 'normal' && (
                  <span className="text-[10px] text-slate-500">Keep all rolls</span>
                )}
              </div>
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-700 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAdvantageMode('normal')}
                  className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    advantageMode === 'normal' ? 'bg-slate-800 text-slate-100 font-semibold' : 'text-slate-400'
                  }`}
                  title="Normal mode: displays all rolled d20s in order without filtering"
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setAdvantageMode('advantage')}
                  className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    advantageMode === 'advantage' ? 'bg-emerald-900/80 text-emerald-300 font-semibold' : 'text-slate-400'
                  }`}
                  title="Advantage mode: rolls 2d20 and takes highest"
                >
                  Adv
                </button>
                <button
                  type="button"
                  onClick={() => setAdvantageMode('disadvantage')}
                  className={`flex-1 py-1 text-[11px] font-medium rounded transition-colors cursor-pointer ${
                    advantageMode === 'disadvantage' ? 'bg-red-900/80 text-red-300 font-semibold' : 'text-slate-400'
                  }`}
                  title="Disadvantage mode: rolls 2d20 and takes lowest"
                >
                  Dis
                </button>
              </div>
            </div>
          </div>

          {/* Roll Visibility Mode 3-Way Selector: Public Roll, DM Roll, Self Roll */}
          <div className="pt-1">
            <label className="text-xs text-slate-400 block mb-1.5 font-medium">
              Roll Visibility Mode:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setVisibility('public')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  visibility === 'public'
                    ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-sm'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Public Roll</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('dm')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  visibility === 'dm'
                    ? 'bg-purple-950 border-purple-500 text-purple-200 shadow-sm ring-1 ring-purple-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <EyeOff className="w-3.5 h-3.5" />
                <span>DM Roll</span>
              </button>

              <button
                type="button"
                onClick={() => setVisibility('self')}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                  visibility === 'self'
                    ? 'bg-cyan-950 border-cyan-500 text-cyan-200 shadow-sm ring-1 ring-cyan-500/50'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Self Roll</span>
              </button>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">
              {visibility === 'public' && '🌐 Broadcasted to all tabs in the room.'}
              {visibility === 'dm' && '🤫 Secret roll: Shared only with the Dungeon Master.'}
              {visibility === 'self' && '🔒 Private scratchpad: Visible only to you. Never broadcast to the room.'}
            </span>
          </div>

          {/* Roll Context / Label & Main Action Roll Button */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <input
              type="text"
              placeholder="Roll label or context (e.g. Stealth Check, Longsword Attack, Fireball Damage)"
              value={rollLabel}
              onChange={(e) => setRollLabel(e.target.value)}
              className="flex-1 min-w-[200px] px-3 py-2 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400"
            />

            {/* Main Primary Action Roll Button */}
            <button
              type="button"
              onClick={() => handleRoll()}
              disabled={totalStagedDice === 0}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold text-sm text-slate-950 bg-amber-400 hover:bg-amber-300 transition-all cursor-pointer shadow-md transform disabled:opacity-40 disabled:cursor-not-allowed ${
                rollingAnimation ? 'scale-95 bg-amber-300' : 'hover:-translate-y-0.5'
              }`}
            >
              <Dices className={`w-4 h-4 ${rollingAnimation ? 'animate-spin' : ''}`} />
              <span>
                Roll {rollType}: {stagedFormulaText} ({displayMode === 'sum' ? 'Sum Mode' : 'Individual Mode'})
              </span>
            </button>
          </div>
        </div>

        {/* CUSTOM QUICK ROLL MACROS & FORMULA ROLLER */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
          
          {/* Formula Runner */}
          <form onSubmit={handleCustomRoll} className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">Formula:</span>
            <input
              type="text"
              placeholder="e.g. 2d6+3, 8d6, 1d20+7, 1d10+4"
              value={customFormula}
              onChange={(e) => setCustomFormula(e.target.value)}
              className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-400"
            />
            <button
              type="submit"
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors cursor-pointer"
            >
              Roll Formula
            </button>
          </form>

          {/* Custom Quick Roll Macros Header */}
          <div className="border-t border-slate-800/80 pt-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
                  Session Custom Quick Macros ({customMacros.length}):
                </span>
                <span className="text-[11px] text-slate-400">
                  Custom rolls, formulas, and buttons persist across page reloads and future sessions
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleResetMacros}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition cursor-pointer shadow-sm"
                  title="Reset custom macros back to starter defaults"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Defaults</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingMacro(true)}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Add Custom Macro</span>
                </button>
              </div>
            </div>

            {/* Add Custom Macro Form (Inline) */}
            {isAddingMacro && (
              <form onSubmit={handleCreateMacro} className="p-3.5 rounded-lg bg-slate-950 border border-amber-500/40 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-800">
                  <span className="text-xs font-semibold text-amber-300">Create New Custom Quick Macro</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingMacro(false);
                      setMacroError('');
                    }}
                    className="text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {macroError && (
                  <div className="text-rose-400 text-xs">{macroError}</div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Macro Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Eldritch Blast, Greatsword, Bardic"
                      value={newMacroName}
                      onChange={(e) => setNewMacroName(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Dice Formula *</label>
                    <input
                      type="text"
                      placeholder="e.g. 1d10+4, 2d6+3, 1d20+5"
                      value={newMacroFormula}
                      onChange={(e) => setNewMacroFormula(e.target.value)}
                      className="w-full px-2.5 py-1 text-xs font-mono rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Roll Type</label>
                    <select
                      value={newMacroType}
                      onChange={(e) => setNewMacroType(e.target.value as RollTypeCategory)}
                      className="w-full px-2 py-1 text-xs rounded bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {ROLL_TYPE_CONFIG.map((c) => (
                        <option key={c.type} value={c.type}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingMacro(false)}
                    className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded cursor-pointer transition shadow"
                  >
                    Save Macro
                  </button>
                </div>
              </form>
            )}

            {/* Custom Macro Chips Grid */}
            {customMacros.length === 0 ? (
              <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-500">
                No custom macros added yet. Click "+ Add Custom Macro" above to create one.
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {customMacros.map((macro) => {
                  const typeCfg = ROLL_TYPE_CONFIG.find((c) => c.type === macro.rollType);
                  return (
                    <div
                      key={macro.id}
                      onClick={() => handleRollCustomMacro(macro)}
                      className="group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-amber-500/70 text-slate-200 transition-all cursor-pointer shadow-sm"
                      title={`Click to roll: ${macro.formula} (${macro.rollType || 'Straight roll'})`}
                    >
                      <span className="text-xs font-semibold group-hover:text-amber-300 transition-colors">
                        {macro.name}
                      </span>
                      <span className="text-[11px] font-mono text-amber-400/90 font-bold px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700/80">
                        {macro.formula}
                      </span>
                      {typeCfg && (
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${typeCfg.badgeClass}`}>
                          {typeCfg.label}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => handleDeleteMacro(macro.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-rose-400 p-0.5 text-slate-500 transition-opacity ml-1 cursor-pointer"
                        title="Delete this macro"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Live Room Roll Feed (Adjusted size: balanced min-height, generous scroll view matching left panel) */}
      <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col min-h-[660px] lg:min-h-[760px] shadow-sm">
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-slate-200 font-display">Live Room Feed</h3>
            <span className="text-xs text-slate-500">({visibleRolls.length} rolls)</span>
          </div>
          {visibleRolls.length > 0 && (
            <button
              type="button"
              onClick={() => {
                liveFeedSync.clearFeed();
                setDiceHistory([]);
              }}
              className="text-slate-400 hover:text-rose-300 text-xs px-2.5 py-1 rounded bg-slate-950/80 hover:bg-rose-950/40 border border-slate-800 hover:border-rose-800/60 transition cursor-pointer flex items-center gap-1 shadow-sm"
              title="Clear Local Feed Log (clears only your view, does not affect others)"
            >
              <Trash2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Clear Log</span>
            </button>
          )}
        </div>

        {/* Scrollable Roll Feed */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 mt-3.5 max-h-[680px]">
          {visibleRolls.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 p-8 my-auto">
              <Dices className="w-10 h-10 mb-3 opacity-30 text-slate-400" />
              <p className="text-sm font-medium text-slate-400">No rolls in room {roomCode} yet.</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs">
                Select your Roll Type, choose a die or click any custom macro to roll live for the party!
              </p>
            </div>
          ) : (
            visibleRolls.map((roll) => {
              const dateStr = new Date(roll.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              const isSecretRoll = roll.visibility === 'dm' || !!roll.isSecret;
              const canSeeSecretDetails = isDm || roll.sender === userName;

              // Secret DM Dice Rolls: Other players must only see a generic log notice
              if (isSecretRoll && !canSeeSecretDetails) {
                return (
                  <div
                    key={roll.id}
                    className="p-3.5 rounded-xl border border-purple-800/60 bg-purple-950/30 text-xs space-y-1.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-purple-200">{roll.sender}</span>
                        <span className="text-[10px] text-purple-300 font-medium px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/80 flex items-center gap-0.5">
                          <EyeOff className="w-2.5 h-2.5" />
                          Secret Roll
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 tabular-nums font-mono">{dateStr}</span>
                    </div>
                    <p className="text-slate-300 font-medium italic">
                      {roll.sender} rolled a secret check to the DM.
                    </p>
                  </div>
                );
              }

              const typeCfg = roll.rollType ? ROLL_TYPE_CONFIG.find((c) => c.type === roll.rollType) : null;

              return (
                <div
                  key={roll.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    roll.isCrit
                      ? 'bg-amber-950/30 border-amber-500/70 shadow-md ring-1 ring-amber-500/30'
                      : roll.isFumble
                      ? 'bg-red-950/30 border-red-500/60 shadow-sm'
                      : 'bg-slate-950/80 border-slate-800/80 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-slate-200">{roll.sender}</span>
                      
                      {roll.isDm && (
                        <span className="text-[10px] text-amber-400 font-medium px-1.5 py-0.5 rounded bg-amber-950/50 border border-amber-800/50">
                          DM
                        </span>
                      )}

                      {/* Roll Type Tag Badge */}
                      {typeCfg && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${typeCfg.badgeClass}`}>
                          {typeCfg.label}
                        </span>
                      )}

                      {roll.visibility === 'dm' && (
                        <span className="text-[10px] text-purple-300 font-medium px-1.5 py-0.5 rounded bg-purple-950/70 border border-purple-800/70 flex items-center gap-0.5">
                          <EyeOff className="w-2.5 h-2.5" />
                          DM Secret
                        </span>
                      )}
                      {roll.visibility === 'self' && (
                        <span className="text-[10px] text-cyan-300 font-medium px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-800/70 flex items-center gap-0.5">
                          <Lock className="w-2.5 h-2.5" />
                          Self Only
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 tabular-nums font-mono">{dateStr}</span>
                  </div>

                  {roll.label && (
                    <div className="text-xs text-amber-200/90 font-medium mb-1.5">
                      {roll.label}
                    </div>
                  )}

                  {/* Results: Sum Mode vs Individual Mode */}
                  {roll.displayMode === 'individual' ? (
                    <div className="space-y-2 pt-1 border-t border-slate-800/60 mt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider font-mono px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/60">
                          Individual Mode ({roll.formula || `${roll.count}${roll.diceType}`})
                        </span>
                        {roll.modifier !== 0 && (
                          <span className="text-[11px] font-mono font-semibold text-slate-300">
                            Selected Modifier: {roll.modifier > 0 ? `+${roll.modifier}` : roll.modifier}
                          </span>
                        )}
                      </div>

                      {/* List each check/attack separately as its own line item without adding them together */}
                      <div className="space-y-1.5 font-mono text-xs">
                        {roll.pairedRolls && roll.pairedRolls.length > 0 ? (
                          roll.pairedRolls.map((pair) => {
                            const isNat20 = pair.selected === 20;
                            const isNat1 = pair.selected === 1;
                            const modVal = pair.modifier ?? roll.modifier ?? 0;
                            const modStr = modVal > 0 ? ` + ${modVal}` : modVal < 0 ? ` - ${Math.abs(modVal)}` : '';
                            const totalVal = pair.totalWithModifier ?? (pair.selected + modVal);
                            return (
                              <div
                                key={pair.pairIndex}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs hover:border-slate-700"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-slate-400 font-bold">Roll {pair.pairIndex}:</span>
                                  <span className="inline-flex items-center">
                                    <span>[</span>
                                    <span
                                      className={`font-bold px-1 rounded ${
                                        isNat20
                                          ? 'bg-amber-400 text-slate-950'
                                          : isNat1
                                          ? 'bg-rose-600 text-white'
                                          : 'text-amber-300'
                                      }`}
                                    >
                                      {pair.selected}
                                    </span>
                                    <span>, </span>
                                    <span className="line-through decoration-rose-500 text-slate-500 font-semibold px-0.5">
                                      {pair.discarded}
                                    </span>
                                    <span>]</span>
                                  </span>
                                  {modStr && <span className="text-slate-300">{modStr}</span>}
                                  <span className="text-slate-400">=</span>
                                  <span
                                    className={`font-bold text-sm ${
                                      isNat20 ? 'text-amber-300' : isNat1 ? 'text-rose-400' : 'text-slate-100'
                                    }`}
                                  >
                                    {totalVal}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isNat20 && (
                                    <span className="text-[10px] font-bold text-amber-400 font-sans uppercase px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/60">
                                      NAT 20
                                    </span>
                                  )}
                                  {isNat1 && (
                                    <span className="text-[10px] font-bold text-rose-400 font-sans uppercase px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-700/60">
                                      NAT 1
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          roll.rolls.map((r, rIdx) => {
                            const isNat20 = roll.diceType === 'd20' && r === 20;
                            const isNat1 = roll.diceType === 'd20' && r === 1;
                            const modVal = roll.modifier ?? 0;
                            const modStr = modVal > 0 ? ` + ${modVal}` : modVal < 0 ? ` - ${Math.abs(modVal)}` : '';
                            const totalVal = r + modVal;
                            return (
                              <div
                                key={rIdx}
                                className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs hover:border-slate-700"
                              >
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-slate-400 font-bold">Roll {rIdx + 1}:</span>
                                  <span className="inline-flex items-center">
                                    <span>[</span>
                                    <span
                                      className={`font-bold px-1 rounded ${
                                        isNat20
                                          ? 'bg-amber-400 text-slate-950'
                                          : isNat1
                                          ? 'bg-rose-600 text-white'
                                          : 'text-amber-300'
                                      }`}
                                    >
                                      {r}
                                    </span>
                                    <span>]</span>
                                  </span>
                                  {modStr && <span className="text-slate-300">{modStr}</span>}
                                  <span className="text-slate-400">=</span>
                                  <span
                                    className={`font-bold text-sm ${
                                      isNat20 ? 'text-amber-300' : isNat1 ? 'text-rose-400' : 'text-slate-100'
                                    }`}
                                  >
                                    {totalVal}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {isNat20 && (
                                    <span className="text-[10px] font-bold text-amber-400 font-sans uppercase px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/60">
                                      NAT 20
                                    </span>
                                  )}
                                  {isNat1 && (
                                    <span className="text-[10px] font-bold text-rose-400 font-sans uppercase px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-700/60">
                                      NAT 1
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  ) : (
                    /* Sum Mode (Default) */
                    <div className="space-y-1.5 pt-0.5">
                      <div className="flex items-baseline justify-between gap-3 flex-wrap">
                        {/* Breakdown: All rolled pairs with discarded dice struck through, plus the modifier */}
                        <div className="text-xs text-slate-300 font-mono flex items-center gap-1.5 flex-wrap">
                          {roll.pairedRolls && roll.pairedRolls.length > 0 ? (
                            <span className="inline-flex items-center gap-1.5 flex-wrap">
                              {roll.pairedRolls.map((pair, pIdx) => (
                                <span key={pair.pairIndex} className="inline-flex items-center gap-0.5">
                                  {pIdx > 0 && <span className="text-slate-500 mr-1">+</span>}
                                  <span>[</span>
                                  <span
                                    className={
                                      pair.selected === 20
                                        ? 'font-bold text-amber-400'
                                        : pair.selected === 1
                                        ? 'font-bold text-rose-400'
                                        : 'font-bold text-slate-100'
                                    }
                                  >
                                    {pair.selected}
                                  </span>
                                  <span>, </span>
                                  <span className="line-through decoration-rose-500 text-slate-500 font-semibold opacity-75">
                                    {pair.discarded}
                                  </span>
                                  <span>]</span>
                                </span>
                              ))}
                              {roll.modifier !== 0 && (
                                <span> {roll.modifier > 0 ? `+ ${roll.modifier}` : `- ${Math.abs(roll.modifier)}`}</span>
                              )}
                              <span> = </span>
                            </span>
                          ) : (
                            <>
                              <span>{roll.formula || `${roll.count > 1 ? `${roll.count}` : ''}${roll.diceType}`}</span>
                              {roll.advantageMode !== 'normal' && (
                                <span className="ml-1 text-[11px] text-amber-300">({roll.advantageMode})</span>
                              )}
                              <span>: [ {(roll.rolls || [roll.total]).join(' + ')} ]</span>
                              {roll.modifier !== 0 && (
                                <span> {roll.modifier > 0 ? `+ ${roll.modifier}` : `- ${Math.abs(roll.modifier)}`}</span>
                              )}
                              <span> = </span>
                            </>
                          )}
                        </div>

                        {/* Grand Total output at the end */}
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-slate-400 uppercase font-semibold font-mono">Grand Total:</span>
                          {roll.isCrit && (
                            <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider animate-bounce">
                              NAT 20 CRIT!
                            </span>
                          )}
                          {roll.isFumble && (
                            <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider">
                              NAT 1 FUMBLE
                            </span>
                          )}
                          <span
                            className={`text-2xl font-bold font-mono tabular-nums ${
                              roll.isCrit
                                ? 'text-amber-300'
                                : roll.isFumble
                                ? 'text-red-400'
                                : 'text-slate-100'
                            }`}
                          >
                            {roll.total}
                          </span>
                        </div>
                      </div>

                      {/* Paired Breakdown under Sum Mode: Discarded dice are visually struck-through and excluded */}
                      {roll.pairedRolls && roll.pairedRolls.length > 0 && (
                        <div className="pt-1.5 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5 text-xs font-mono">
                          <span className="text-[10px] uppercase font-bold text-amber-300">
                            {roll.advantageMode} pairs:
                          </span>
                          {roll.pairedRolls.map((pair) => (
                            <span
                              key={pair.pairIndex}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px]"
                            >
                              <span className="text-slate-500 text-[10px] font-semibold">P{pair.pairIndex}:</span>
                              <span
                                className={`font-bold ${
                                  pair.selected === 20
                                    ? 'text-amber-400'
                                    : pair.selected === 1
                                    ? 'text-rose-400'
                                    : 'text-amber-200'
                                }`}
                              >
                                [{pair.selected}]
                              </span>
                              <span className="text-[10px] text-slate-500 flex items-center gap-0.5 opacity-80">
                                (drop{' '}
                                <span className="line-through decoration-rose-500 text-slate-400 font-semibold">
                                  {pair.discarded}
                                </span>
                                )
                              </span>
                            </span>
                          ))}
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
    </div>
  );
};
