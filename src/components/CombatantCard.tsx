import React, { useState } from 'react';
import { Combatant, CombatantType, Condition, isCombatantFoW } from '../types/ttrpg';
import { getHealthThreshold } from '../utils/combatHealth';
import { isConcentrating, calculateConcentrationDC } from '../utils/concentration';
import {
  Shield,
  Heart,
  Skull,
  Trash2,
  Eye,
  EyeOff,
  Plus,
  Minus,
  Sparkles,
  Edit2,
  X,
  Sliders,
  Check,
  Cloud,
  Dices,
} from 'lucide-react';

interface CombatantCardProps {
  combatant: Combatant;
  isActive: boolean;
  isDm: boolean;
  onUpdate: (updated: Partial<Combatant>) => void;
  onDelete: () => void;
  onAddLog?: (dmMessage: string, playerMessage?: string) => void;
  onRollInitiative?: () => void;
  onToggleVisibility?: () => void;
}

const CONDITIONS_LIST: { name: Condition; color: string }[] = [
  { name: 'Blinded', color: 'text-amber-400 bg-amber-950/70 border-amber-800' },
  { name: 'Charmed', color: 'text-pink-400 bg-pink-950/70 border-pink-800' },
  { name: 'Concentration', color: 'text-cyan-300 bg-cyan-950/80 border-cyan-600' },
  { name: 'Deafened', color: 'text-blue-400 bg-blue-950/70 border-blue-800' },
  { name: 'Exhaustion', color: 'text-zinc-400 bg-zinc-900 border-zinc-700' },
  { name: 'Frightened', color: 'text-purple-400 bg-purple-950/70 border-purple-800' },
  { name: 'Grappled', color: 'text-orange-400 bg-orange-950/70 border-orange-800' },
  { name: 'Incapacitated', color: 'text-red-400 bg-red-950/70 border-red-800' },
  { name: 'Invisible', color: 'text-emerald-400 bg-emerald-950/70 border-emerald-800' },
  { name: 'Paralyzed', color: 'text-rose-500 bg-rose-950/80 border-rose-800' },
  { name: 'Petrified', color: 'text-stone-400 bg-stone-900 border-stone-700' },
  { name: 'Poisoned', color: 'text-lime-400 bg-lime-950/70 border-lime-800' },
  { name: 'Prone', color: 'text-yellow-400 bg-yellow-950/70 border-yellow-800' },
  { name: 'Restrained', color: 'text-amber-500 bg-amber-950/80 border-amber-800' },
  { name: 'Stunned', color: 'text-indigo-400 bg-indigo-950/70 border-indigo-800' },
  { name: 'Unconscious', color: 'text-red-500 bg-red-950/90 border-red-800' },
];

const ROLE_STYLES: Record<CombatantType, { label: string; badge: string; cardBorder: string }> = {
  player: { label: 'PC', badge: 'bg-cyan-950/90 text-cyan-300 border-cyan-700/80', cardBorder: 'border-cyan-800/40' },
  ally: { label: 'NPC', badge: 'bg-emerald-950/90 text-emerald-300 border-emerald-700/80', cardBorder: 'border-emerald-800/40' },
  monster: { label: 'Monster', badge: 'bg-rose-950/90 text-rose-300 border-rose-800/80', cardBorder: 'border-rose-800/40' },
  boss: { label: 'Boss', badge: 'bg-purple-950/95 text-amber-300 border-amber-500/80', cardBorder: 'border-purple-800/50' },
  custom: { label: 'Custom', badge: 'bg-amber-950/90 text-amber-300 border-amber-600/80', cardBorder: 'border-amber-800/40' },
};

export const CombatantCard: React.FC<CombatantCardProps> = ({
  combatant,
  isActive,
  isDm,
  onUpdate,
  onDelete,
  onAddLog,
  onRollInitiative,
  onToggleVisibility,
}) => {
  // FOG OF WAR & ROLE-BASED ACCESS CONTROL (RBAC):
  // 1. Fog of War: If marked with FoW (or monster/boss/custom default), conceal conditions, status badges, stats, and numerical damage from players.
  // 2. Permission Rules: Players may ONLY edit stats & toggle conditions on non-FoW "Player (PC)" and "NPC / Ally" combatants.
  // 3. Enemies and FoW combatants are strictly DM-editable.
  const isFoW = isCombatantFoW(combatant);
  const isPlayerOrAlly = combatant.type === 'player' || combatant.type === 'ally';
  const canEditCombatant = isDm || (isPlayerOrAlly && !isFoW);

  // HP Delta form state
  const [hpDelta, setHpDelta] = useState<string>('');
  const [isAddingCondition, setIsAddingCondition] = useState<boolean>(false);
  const [customConditionInput, setCustomConditionInput] = useState<string>('');

  // Inline Name Edit State
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [nameDraft, setNameDraft] = useState<string>(combatant.name);

  // Full Inline Stat Edit State (Initiative, HP, Max HP, Temp HP, AC)
  const [isEditingStats, setIsEditingStats] = useState<boolean>(false);
  const [initDraft, setInitDraft] = useState<number>(combatant.initiative);
  const [hpCurrDraft, setHpCurrDraft] = useState<number>(combatant.hpCurrent);
  const [hpMaxDraft, setHpMaxDraft] = useState<number>(combatant.hpMax);
  const [hpTempDraft, setHpTempDraft] = useState<number>(combatant.hpTemp || 0);
  const [acDraft, setAcDraft] = useState<number>(combatant.armorClass);

  // Dynamic Health Threshold status
  const healthInfo = getHealthThreshold(combatant.hpCurrent, combatant.hpMax);

  // Quick Damage (-1, -5) - subtracts from Temp HP first, then Current HP
  const handleQuickDamage = (amount: number) => {
    if (!canEditCombatant) return;
    let remainingDamage = amount;
    let newTemp = combatant.hpTemp;
    if (newTemp > 0) {
      if (remainingDamage <= newTemp) {
        newTemp -= remainingDamage;
        remainingDamage = 0;
      } else {
        remainingDamage -= newTemp;
        newTemp = 0;
      }
    }
    const newHp = Math.max(0, combatant.hpCurrent - remainingDamage);
    onUpdate({ hpCurrent: newHp, hpTemp: newTemp });

    // Damage Obfuscation:
    // DM view: "[Name] took [X] damage."
    // Player view: "[Name] took damage." (no numerical damage or HP for FoW combatants)
    const dmMessage = `⚔️ ${combatant.name} took ${amount} damage! (${newHp}/${combatant.hpMax} HP${
      newTemp > 0 ? `, +${newTemp} temp` : ''
    })`;
    const playerMessage = isFoW
      ? `⚔️ ${combatant.name} took damage.`
      : `⚔️ ${combatant.name} took ${amount} damage! (${newHp}/${combatant.hpMax} HP${
          newTemp > 0 ? `, +${newTemp} temp` : ''
        })`;

    if (onAddLog) {
      onAddLog(dmMessage, playerMessage);
    }

    // Concentration DC check (Standard 5e: DC = Math.max(10, Math.floor(damage / 2)))
    if (isConcentrating(combatant)) {
      const dc = calculateConcentrationDC(amount);
      const concDmMessage = `⚡ ${combatant.name} took ${amount} damage while concentrating! DC ${dc} Constitution saving throw required.`;
      const concPlayerMessage = isFoW
        ? `⚔️ ${combatant.name} took damage.`
        : concDmMessage;
      if (onAddLog) {
        onAddLog(concDmMessage, concPlayerMessage);
      }
    }
  };

  // Quick Heal (+1, +5) - adds to Current HP, capped at Max HP
  const handleQuickHeal = (amount: number) => {
    if (!canEditCombatant) return;
    const newHp = Math.min(combatant.hpMax, combatant.hpCurrent + amount);
    onUpdate({ hpCurrent: newHp });
    const dmMessage = `💚 ${combatant.name} healed for ${amount} HP! (${newHp}/${combatant.hpMax} HP)`;
    const playerMessage = isFoW
      ? `💚 ${combatant.name} healed.`
      : `💚 ${combatant.name} healed for ${amount} HP! (${newHp}/${combatant.hpMax} HP)`;
    if (onAddLog) {
      onAddLog(dmMessage, playerMessage);
    }
  };

  // Custom Amount Damage / Heal
  const handleApplyHp = (isDamage: boolean) => {
    if (!canEditCombatant) return;
    const amount = parseInt(hpDelta, 10);
    if (isNaN(amount) || amount <= 0) return;

    if (isDamage) {
      handleQuickDamage(amount);
    } else {
      handleQuickHeal(amount);
    }

    setHpDelta('');
  };

  // Save full inline stat edits
  const handleSaveStats = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditCombatant) return;

    onUpdate({
      initiative: initDraft,
      hpCurrent: Math.max(0, hpCurrDraft),
      hpMax: Math.max(1, hpMaxDraft),
      hpTemp: Math.max(0, hpTempDraft),
      armorClass: Math.max(0, acDraft),
    });

    const dmMessage = `⚙️ ${combatant.name} stats updated: Init ${initDraft}, HP ${hpCurrDraft}/${hpMaxDraft} (+${hpTempDraft} temp), AC ${acDraft}`;
    const playerMessage = isFoW
      ? `⚙️ ${combatant.name} stats updated.`
      : dmMessage;

    if (onAddLog) {
      onAddLog(dmMessage, playerMessage);
    }

    setIsEditingStats(false);
  };

  // Start editing stats
  const handleOpenStatEditor = () => {
    if (!canEditCombatant) return;
    setInitDraft(combatant.initiative);
    setHpCurrDraft(combatant.hpCurrent);
    setHpMaxDraft(combatant.hpMax);
    setHpTempDraft(combatant.hpTemp || 0);
    setAcDraft(combatant.armorClass);
    setIsEditingStats(true);
  };

  // Add custom or preset condition
  const handleAddCondition = (nameToAdd?: string) => {
    if (!canEditCombatant) return;
    const name = (nameToAdd !== undefined ? nameToAdd : customConditionInput).trim();
    if (!name) return;
    if (combatant.conditions.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      setCustomConditionInput('');
      setIsAddingCondition(false);
      return;
    }

    const updated = [...combatant.conditions, { name }];
    onUpdate({ conditions: updated });
    onAddLog && onAddLog(`⚡ ${combatant.name} gained condition: ${name}`);
    setCustomConditionInput('');
    setIsAddingCondition(false);
  };

  // Remove condition
  const handleRemoveCondition = (condName: string) => {
    if (!canEditCombatant) return;
    const updated = combatant.conditions.filter((c) => c.name !== condName);
    onUpdate({ conditions: updated });
    onAddLog && onAddLog(`✨ ${combatant.name} recovered from ${condName}`);
  };

  const roleStyle = ROLE_STYLES[combatant.type] || ROLE_STYLES.player;

  return (
    <div
      className={`rounded-2xl border transition-all p-4 shadow-md ${
        isActive
          ? 'bg-slate-900 border-amber-400 ring-2 ring-amber-400/60 shadow-amber-950/40 shadow-xl'
          : `bg-slate-900/80 ${roleStyle.cardBorder} hover:border-slate-700`
      }`}
    >
      {/* Top Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Initiative Badge & Quick Roll (Click to quick edit for authorized users) */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={canEditCombatant ? handleOpenStatEditor : undefined}
              disabled={!canEditCombatant}
              title={canEditCombatant ? 'Click to edit initiative and stats' : `Initiative: ${combatant.initiative}`}
              className={`w-8 h-8 rounded-xl flex items-center justify-center font-mono font-bold text-sm shadow-sm transition ${
                canEditCombatant ? 'cursor-pointer hover:ring-2 hover:ring-amber-400' : 'cursor-default'
              } ${
                isActive
                  ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}
            >
              {combatant.initiative}
            </button>
            {canEditCombatant && onRollInitiative && (
              <button
                type="button"
                onClick={onRollInitiative}
                title={`Roll 1d20 Initiative for ${combatant.name}`}
                className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition cursor-pointer"
              >
                <Dices className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Name & Role */}
          <div className="min-w-0">
            {isEditingName && canEditCombatant ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="px-2 py-0.5 text-xs rounded bg-slate-950 border border-amber-400 text-slate-100 focus:outline-none"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => {
                    if (nameDraft.trim()) {
                      onUpdate({ name: nameDraft.trim() });
                    }
                    setIsEditingName(false);
                  }}
                  className="px-2 py-0.5 text-xs bg-amber-400 text-slate-950 font-bold rounded cursor-pointer"
                >
                  ✓
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingName(false)}
                  className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h4
                  className={`text-sm font-bold truncate ${
                    isActive ? 'text-amber-300' : 'text-slate-100'
                  }`}
                >
                  {combatant.name}
                </h4>
                {canEditCombatant && (
                  <button
                    type="button"
                    onClick={() => {
                      setNameDraft(combatant.name);
                      setIsEditingName(true);
                    }}
                    className="text-slate-500 hover:text-amber-300 p-0.5 transition cursor-pointer"
                    title="Rename Combatant"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Badges: Role, Custom Label, Dynamic Health Status */}
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${roleStyle.badge}`}
              >
                {combatant.type === 'custom' && combatant.customRoleLabel
                  ? combatant.customRoleLabel
                  : roleStyle.label}
              </span>

              {/* Dynamic Health Threshold Badge: Hidden from player view when combatant is marked with Fog of War */}
              {(isDm || !isFoW) && (
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${healthInfo.badgeClass}`}
                  title={`Health Status: ${healthInfo.status}`}
                >
                  {healthInfo.badgeLabel}
                </span>
              )}

              {isActive && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 animate-pulse">
                  ACTIVE TURN
                </span>
              )}

              {isFoW && isDm && (
                <span className="text-[10px] text-purple-300 bg-purple-950/80 border border-purple-700 px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                  <Cloud className="w-3 h-3 text-purple-400" /> FoW Active
                </span>
              )}

              {(combatant.hidden || combatant.isSecret) && isDm && (
                <span className="text-[10px] text-purple-300 bg-purple-950/90 border border-purple-600/80 px-2 py-0.5 rounded-md flex items-center gap-1 font-bold shadow-sm">
                  <EyeOff className="w-3 h-3 text-purple-400" /> Hidden / Secret
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Top Right Controls (Edit stats trigger, DM visibility toggle, delete) */}
        <div className="flex items-center gap-1">
          {canEditCombatant && (
            <button
              type="button"
              onClick={handleOpenStatEditor}
              title="Edit Stats (HP, Max HP, Temp HP, AC, Initiative)"
              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg border transition cursor-pointer ${
                isEditingStats
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-amber-300 hover:border-slate-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Edit Stats</span>
            </button>
          )}

          {/* DM Fog of War Privacy Toggle */}
          {isDm && (
            <button
              type="button"
              onClick={() => onUpdate({ fogOfWar: !isFoW })}
              title={isFoW ? 'Disable Fog of War (Reveal status & conditions to players)' : 'Enable Fog of War (Conceal status & conditions from players)'}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                isFoW
                  ? 'bg-purple-950 border-purple-500 text-purple-300 shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-purple-300 hover:border-purple-800'
              }`}
            >
              <Cloud className="w-4 h-4" />
            </button>
          )}

          {isDm && (
            <button
              type="button"
              onClick={onToggleVisibility ? onToggleVisibility : () => onUpdate({ hidden: !(combatant.hidden || combatant.isSecret), isSecret: false })}
              title={combatant.hidden || combatant.isSecret ? 'Reveal to Players' : 'Hide from Players'}
              className={`p-1.5 rounded-lg border transition cursor-pointer ${
                combatant.hidden || combatant.isSecret
                  ? 'bg-purple-950 border-purple-600 text-purple-300 ring-1 ring-purple-500/50'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {combatant.hidden || combatant.isSecret ? <EyeOff className="w-4 h-4 text-purple-300" /> : <Eye className="w-4 h-4" />}
            </button>
          )}

          {isDm && (
            <button
              type="button"
              onClick={onDelete}
              title="Remove from Combat"
              className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-500 hover:text-rose-400 hover:border-rose-900 transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* INLINE FULL STAT EDITOR (HP, Max HP, Temp HP, AC, Initiative) */}
      {isEditingStats && canEditCombatant && (
        <form onSubmit={handleSaveStats} className="my-3 p-3 rounded-xl bg-slate-950 border border-amber-500/50 space-y-3">
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5" /> Direct Attribute &amp; Stat Editor
            </span>
            <button
              type="button"
              onClick={() => setIsEditingStats(false)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Initiative
              </label>
              <input
                type="number"
                value={initDraft}
                onChange={(e) => setInitDraft(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-900 border border-slate-700 text-amber-300 text-center focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-rose-400 block mb-1">
                Current HP
              </label>
              <input
                type="number"
                min="0"
                value={hpCurrDraft}
                onChange={(e) => setHpCurrDraft(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-900 border border-slate-700 text-slate-100 text-center focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Max HP
              </label>
              <input
                type="number"
                min="1"
                value={hpMaxDraft}
                onChange={(e) => setHpMaxDraft(parseInt(e.target.value, 10) || 1)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-900 border border-slate-700 text-slate-100 text-center focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-cyan-400 block mb-1">
                Temp HP
              </label>
              <input
                type="number"
                min="0"
                value={hpTempDraft}
                onChange={(e) => setHpTempDraft(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-900 border border-slate-700 text-cyan-300 text-center focus:outline-none focus:border-amber-400"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                Armor Class
              </label>
              <input
                type="number"
                min="0"
                value={acDraft}
                onChange={(e) => setAcDraft(parseInt(e.target.value, 10) || 0)}
                className="w-full px-2 py-1 text-xs font-mono font-bold rounded bg-slate-900 border border-slate-700 text-slate-100 text-center focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setIsEditingStats(false)}
              className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded cursor-pointer transition shadow"
            >
              Save Attributes
            </button>
          </div>
        </form>
      )}

      {/* Middle Section: Stats & Action Controls */}
      <div className="py-3 space-y-3">
        {canEditCombatant ? (
          /* FULL STATS & DAMAGE / HEAL CONTROLS (DM, or Player viewing PC/Ally) */
          <div className="space-y-3">
            {/* Top Stat Row: HP Bar & AC Badge */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
              {/* HP Bar & Metrics */}
              <div className="sm:col-span-8 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400 flex items-center gap-1 font-semibold">
                      <Heart className="w-3.5 h-3.5 text-rose-400" /> HP:
                    </span>
                    <button
                      type="button"
                      onClick={handleOpenStatEditor}
                      title="Click to edit HP"
                      className="font-mono font-bold text-slate-100 hover:text-amber-300 cursor-pointer"
                    >
                      {combatant.hpCurrent} / {combatant.hpMax}
                    </button>
                    {combatant.hpTemp > 0 && (
                      <span className="text-cyan-400 font-mono text-[11px] font-semibold bg-cyan-950/80 px-1.5 py-0.2 rounded border border-cyan-800/60">
                        +{combatant.hpTemp} temp
                      </span>
                    )}
                  </div>

                  <span className="text-[11px] font-mono text-slate-400">
                    {healthInfo.percentage}%
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800">
                  <div
                    style={{
                      width: `${Math.min(
                        100,
                        (combatant.hpCurrent / Math.max(1, combatant.hpMax)) * 100
                      )}%`,
                    }}
                    className={`h-full transition-all duration-300 ${
                      healthInfo.status === 'Critical'
                        ? 'bg-rose-600'
                        : healthInfo.status === 'Bloodied'
                        ? 'bg-amber-500'
                        : healthInfo.status === 'Hurt'
                        ? 'bg-yellow-500'
                        : 'bg-emerald-500'
                    }`}
                  />
                </div>
              </div>

              {/* Armor Class Badge */}
              <div className="sm:col-span-4 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleOpenStatEditor}
                  title="Click to edit AC"
                  className="flex items-center gap-1.5 bg-slate-950 hover:border-amber-400 px-3 py-1.5 rounded-xl border border-slate-800 transition cursor-pointer text-xs"
                >
                  <Shield className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-slate-400 text-[11px]">AC:</span>
                  <span className="font-mono font-bold text-slate-100">{combatant.armorClass}</span>
                </button>
              </div>
            </div>

            {/* Quick Modifiers & Custom Amount Bar */}
            <div className="p-2 rounded-xl bg-slate-950/90 border border-slate-800/90 flex flex-wrap items-center justify-between gap-2 text-xs">
              {/* One-Click Quick Modifier Buttons: -5, -1, +1, +5 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Dmg:
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickDamage(5)}
                  className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-700/80 text-rose-300 hover:text-white transition cursor-pointer shadow-sm"
                  title="Deal 5 Damage (subtracts from Temp HP first)"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDamage(1)}
                  className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-700/80 text-rose-300 hover:text-white transition cursor-pointer shadow-sm"
                  title="Deal 1 Damage (subtracts from Temp HP first)"
                >
                  -1
                </button>

                <div className="h-4 w-px bg-slate-800 mx-1" />

                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  Heal:
                </span>
                <button
                  type="button"
                  onClick={() => handleQuickHeal(1)}
                  className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 hover:text-white transition cursor-pointer shadow-sm"
                  title="Heal 1 HP (capped at Max HP)"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickHeal(5)}
                  className="px-2 py-1 text-xs font-mono font-bold rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-300 hover:text-white transition cursor-pointer shadow-sm"
                  title="Heal 5 HP (capped at Max HP)"
                >
                  +5
                </button>
              </div>

              {/* Custom Amount Form: [Amt] [- Dmg] [+ Heal] */}
              <div className="flex items-center gap-1 ml-auto">
                <input
                  type="number"
                  min="1"
                  placeholder="Amt"
                  value={hpDelta}
                  onChange={(e) => setHpDelta(e.target.value)}
                  className="w-14 px-2 py-1 text-xs font-mono font-bold rounded-lg bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 text-center"
                />
                <button
                  type="button"
                  onClick={() => handleApplyHp(true)}
                  disabled={!hpDelta}
                  title="Apply Custom Damage"
                  className="px-2 py-1 text-xs font-bold rounded-lg bg-rose-900/80 hover:bg-rose-800 border border-rose-700 text-rose-200 disabled:opacity-30 cursor-pointer"
                >
                  - Dmg
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyHp(false)}
                  disabled={!hpDelta}
                  title="Apply Custom Heal"
                  className="px-2 py-1 text-xs font-bold rounded-lg bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 disabled:opacity-30 cursor-pointer"
                >
                  + Heal
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* FOG OF WAR (Players looking at Monster, Boss, Custom, or FoW entity - Read-Only with Stats Concealed) */
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 italic">
                Tactical stats &amp; condition status concealed by Fog of War.
              </span>
            </div>
            {isDm ? (
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Condition Status:</span>
                <span className={`text-xs font-bold ${healthInfo.textColor}`}>
                  {healthInfo.status}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-purple-400 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded font-mono">
                Concealed
              </span>
            )}
          </div>
        )}

        {/* Conditions Section: When a combatant is marked with Fog of War, hide all active conditions on Player view (visible only to DM) */}
        {(isDm || !isFoW) && (
          <div className="space-y-2 pt-2 border-t border-slate-800/80">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">
                Conditions:
              </span>

              {combatant.conditions.length === 0 && !isAddingCondition && (
                <span className="text-[11px] text-slate-500 italic">None active</span>
              )}

              {combatant.conditions.map((cond) => {
                const condCfg = CONDITIONS_LIST.find(
                  (c) => c.name.toLowerCase() === cond.name.toLowerCase()
                );
                return (
                  <span
                    key={cond.name}
                    className={`text-[11px] px-2 py-0.5 rounded-lg border font-medium flex items-center gap-1.5 shadow-sm transition-all ${
                      condCfg ? condCfg.color : 'text-amber-300 bg-amber-950/70 border-amber-800/80'
                    }`}
                  >
                    <span>{cond.name}</span>
                    {canEditCombatant && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCondition(cond.name)}
                        className="hover:text-rose-400 p-0.5 text-slate-400 transition cursor-pointer"
                        title={`Remove condition "${cond.name}"`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                );
              })}

              {/* Lightweight "Add Condition" Button (Guarded by RBAC permissions: PC and Ally only for players) */}
              {canEditCombatant && !isAddingCondition && (
                <button
                  type="button"
                  onClick={() => setIsAddingCondition(true)}
                  className="flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-dashed border-slate-700 hover:border-amber-400 text-slate-400 hover:text-amber-300 transition cursor-pointer"
                  title="Add a custom condition or status effect"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Condition</span>
                </button>
              )}
            </div>

            {/* Lightweight Inline Popover / Input for Custom Condition Tagging */}
            {canEditCombatant && isAddingCondition && (
              <div className="p-2.5 rounded-xl bg-slate-950 border border-amber-500/40 space-y-2 shadow-inner">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Type custom condition (e.g. Hexed, Grappled, Bane -1d4)"
                    value={customConditionInput}
                    onChange={(e) => setCustomConditionInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddCondition();
                      } else if (e.key === 'Escape') {
                        setIsAddingCondition(false);
                        setCustomConditionInput('');
                      }
                    }}
                    autoFocus
                    className="flex-1 px-2.5 py-1 text-xs rounded-lg bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddCondition()}
                    disabled={!customConditionInput.trim()}
                    className="px-3 py-1 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg cursor-pointer transition disabled:opacity-40"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCondition(false);
                      setCustomConditionInput('');
                    }}
                    className="p-1 text-slate-400 hover:text-slate-200 text-xs cursor-pointer rounded"
                    title="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Quick Suggestions / Common Tags */}
                <div className="flex flex-wrap items-center gap-1 pt-0.5">
                  <span className="text-[10px] text-slate-500 mr-1 font-medium">Quick Suggestions:</span>
                  {[
                    'Grappled',
                    'Hexed',
                    'Bane (-1d4)',
                    'Bless (+1d4)',
                    'Prone',
                    'Stunned',
                    'Invisible',
                    'Concentration',
                    'Frightened',
                    'Poisoned',
                    'Restrained',
                  ].map((preset) => {
                    const alreadyHas = combatant.conditions.some(
                      (c) => c.name.toLowerCase() === preset.toLowerCase()
                    );
                    if (alreadyHas) return null;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleAddCondition(preset)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-amber-300 hover:border-amber-400 transition cursor-pointer"
                      >
                        +{preset}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
