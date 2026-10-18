import React, { useState, useEffect, useRef } from 'react';
import {
  Combatant,
  CombatantType,
  CustomCondition,
  isCombatantFoW,
  getEffectiveAc,
} from '../../types/ttrpg';
import { getHealthThreshold } from '../../utils/combatHealth';
import { isConcentrating, calculateConcentrationDC } from '../../utils/concentration';
import {
  Heart,
  MoreVertical,
  ChevronUp,
  ChevronDown,
  Check,
  X,
  Zap,
  EyeOff,
  User,
  Users,
  Skull,
  Crown,
  Layers,
  Clock,
  Shield,
  Plus,
  Link as LinkIcon,
} from 'lucide-react';
import { ConditionPicker } from './ConditionPicker';

export interface CombatantRowProps {
  combatant: Combatant;
  index: number;
  totalVisible: number;
  isActive: boolean;
  isDm: boolean;
  playerName?: string;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  isActionMenuOpen: boolean;
  onToggleActionMenu: (combatantId: string) => void;
  onRollInitiative?: (combatantId: string) => void;
  onMoveCombatant?: (combatantId: string, direction: -1 | 1) => void;
  onHpDelta: (combatantId: string, delta: number) => void;
  onUpdateMaxHp?: (combatantId: string, newMaxHp: number) => void;
  onUpdateDeathSaves?: (combatantId: string, saves: { successes: number; failures: number }) => void;
  onUpdateCombatant?: (combatantId: string, updates: Partial<Combatant>) => void;
  onDuplicateCombatant?: (combatantId: string) => void;
  onDeployCombatant?: (combatantId: string) => void;
  onDeleteCombatant?: (combatantId: string) => void;
  onSaveThp?: (combatantId: string, thp: number) => void;
  onRemoveCondition?: (combatantId: string, condIdOrName: string) => void;
  onAddCondition?: (combatantId: string, conditionText: string) => void;
  concentrationAlert?: { dc: number; expiresAt: number };
  inlineThpId?: string | null;
  setInlineThpId?: (id: string | null) => void;
  inlineThpVal?: number;
  setInlineThpVal?: (val: number) => void;
  onSaveInlineThp?: (combatantId: string) => void;
}

const normalizeCondition = (c: any): CustomCondition => {
  if (typeof c === 'string') {
    return {
      id: `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: c,
      isSecret: false,
      timing: 'none',
    };
  }
  return {
    id: c.id || `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: c.name || '',
    isSecret: !!c.isSecret,
    turnsLeft: c.turnsLeft,
    timing: c.timing || 'none',
  };
};

const getConditionBadgeStyle = (name: string): string => {
  const lower = (name || '').toLowerCase().trim();
  if (name.includes('+2 AC') || lower.includes('half cover') || lower.includes('shield of faith')) {
    return 'bg-cyan-950/90 border-cyan-500/80 text-cyan-300 font-bold';
  }
  if (name.includes('+5 AC') || lower.startsWith('shield')) {
    return 'bg-blue-950/90 border-blue-500/80 text-blue-300 font-bold';
  }
  if (lower.startsWith('concentration')) return 'bg-cyan-950/90 border-cyan-500/80 text-cyan-300';
  if (lower.startsWith('poisoned')) return 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300';
  if (lower.startsWith('prone')) return 'bg-amber-950/90 border-amber-500/80 text-amber-300';
  if (lower.startsWith('blinded') || lower.startsWith('deafened')) return 'bg-slate-800 border-slate-600 text-slate-300';
  if (lower.startsWith('charmed') || lower.startsWith('frightened')) return 'bg-purple-950/90 border-purple-500/80 text-purple-300';
  if (
    lower.startsWith('paralyzed') ||
    lower.startsWith('petrified') ||
    lower.startsWith('stunned') ||
    lower.startsWith('incapacitated')
  ) {
    return 'bg-yellow-950/90 border-yellow-500/80 text-yellow-300';
  }
  if (lower.startsWith('grappled') || lower.startsWith('restrained')) return 'bg-blue-950/90 border-blue-500/80 text-blue-300';
  if (lower.startsWith('unconscious')) return 'bg-rose-950/90 border-rose-600/80 text-rose-300';
  if (lower.startsWith('exhaustion')) return 'bg-orange-950/90 border-orange-500/80 text-orange-300';
  if (lower.startsWith('bless')) return 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300';
  if (lower.startsWith('bane')) return 'bg-violet-950/90 border-violet-500/80 text-violet-300';
  return 'bg-slate-800 border-slate-700 text-slate-300';
};

const ROLE_CONFIG: Record<
  CombatantType,
  { borderL: string; badge: string; label: string; icon: React.ReactNode }
> = {
  player: {
    borderL: 'border-l-sky-500',
    badge: 'bg-sky-500/15 text-sky-400 border-sky-800/50',
    label: 'PC',
    icon: <User className="w-2.5 h-2.5" />,
  },
  ally: {
    borderL: 'border-l-emerald-500',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-800/50',
    label: 'Ally',
    icon: <Users className="w-2.5 h-2.5" />,
  },
  monster: {
    borderL: 'border-l-rose-500',
    badge: 'bg-rose-500/15 text-rose-400 border-rose-800/50',
    label: 'Monster',
    icon: <Skull className="w-2.5 h-2.5 text-rose-400" />,
  },
  boss: {
    borderL: 'border-l-purple-500',
    badge: 'bg-purple-500/15 text-purple-300 border-purple-700/50',
    label: 'Boss',
    icon: <Crown className="w-2.5 h-2.5 text-purple-400" />,
  },
  custom: {
    borderL: 'border-l-amber-500',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-800/50',
    label: 'Custom',
    icon: <Layers className="w-2.5 h-2.5 text-amber-400" />,
  },
};

const CombatantRowInner: React.FC<CombatantRowProps> = ({
  combatant,
  index,
  totalVisible,
  isActive,
  isDm,
  playerName,
  isExpanded,
  onToggleExpand,
  isActionMenuOpen,
  onToggleActionMenu,
  onRollInitiative,
  onMoveCombatant,
  onHpDelta,
  onUpdateMaxHp,
  onUpdateDeathSaves,
  onUpdateCombatant,
  onDuplicateCombatant,
  onDeployCombatant,
  onDeleteCombatant,
  onSaveThp,
  onRemoveCondition,
  onAddCondition,
  concentrationAlert,
  inlineThpId,
  setInlineThpId,
  inlineThpVal,
  setInlineThpVal,
  onSaveInlineThp,
}) => {
  const isUnderFoW = isCombatantFoW(combatant);
  const isReserve = !!(combatant.isReserve || combatant.hidden || combatant.isSecret);

  const isPlayerOrAlly =
    combatant.role === 'PC' ||
    combatant.role === 'Player' ||
    combatant.role === 'Ally' ||
    combatant.type === 'player' ||
    combatant.type === 'ally';

  const canEdit = isDm || isPlayerOrAlly;

  // 300ms trailing debounce for rapid HP adjustments (-5, -1, +1, +5)
  const [localHp, setLocalHp] = useState<number>(combatant.hpCurrent);
  const pendingHpDeltaRef = useRef<number>(0);
  const hpDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDebouncingHpRef = useRef<boolean>(false);
  const isInputFocusedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!isDebouncingHpRef.current) {
      setLocalHp(combatant.hpCurrent);
    }
  }, [combatant.hpCurrent]);

  useEffect(() => {
    return () => {
      if (hpDebounceTimerRef.current) {
        clearTimeout(hpDebounceTimerRef.current);
        if (pendingHpDeltaRef.current !== 0) {
          onHpDelta(combatant.id, pendingHpDeltaRef.current);
        }
      }
    };
  }, [combatant.id, onHpDelta]);

  const handleQuickHpAdjust = (delta: number) => {
    if (!canEdit) return;
    isDebouncingHpRef.current = true;
    pendingHpDeltaRef.current += delta;
    setLocalHp((prev) => Math.max(0, Math.min(combatant.hpMax, prev + delta)));

    if (hpDebounceTimerRef.current) {
      clearTimeout(hpDebounceTimerRef.current);
    }
    hpDebounceTimerRef.current = setTimeout(() => {
      const totalDelta = pendingHpDeltaRef.current;
      pendingHpDeltaRef.current = 0;
      isDebouncingHpRef.current = false;
      if (totalDelta !== 0) {
        onHpDelta(combatant.id, totalDelta);
      }
    }, 300);
  };

  const health = getHealthThreshold(localHp, combatant.hpMax);
  const effectiveAcInfo = getEffectiveAc(combatant);

  const visibleConditions = combatant.conditions
    .map(normalizeCondition)
    .filter((cond) => isDm || !cond.isSecret);

  const timingReminders = visibleConditions.filter(
    (cond) => cond.timing === 'start' || cond.timing === 'end'
  );

  // Quick HP Popover State
  const [isHpPopoverOpen, setIsHpPopoverOpen] = useState<boolean>(false);
  const [damageAmount, setDamageAmount] = useState<string>('');
  const [healAmount, setHealAmount] = useState<string>('');
  const [maxHpInput, setMaxHpInput] = useState<string>(combatant.hpMax.toString());
  const hpPopoverRef = useRef<HTMLDivElement>(null);
  const hpButtonRef = useRef<HTMLButtonElement>(null);

  // Freeform Condition Popover State
  const [isConditionPickerOpen, setIsConditionPickerOpen] = useState<boolean>(false);
  const conditionPickerRef = useRef<HTMLDivElement>(null);
  const conditionTriggerRef = useRef<HTMLButtonElement>(null);

  const [localConcentrationAlert, setLocalConcentrationAlert] = useState<{
    dc: number;
    expiresAt: number;
  } | null>(null);

  const activeConcentrationAlert = localConcentrationAlert || concentrationAlert;

  // Input Focus Shielding: Do not overwrite active input while popover open or focused
  useEffect(() => {
    if (!isHpPopoverOpen && !isInputFocusedRef.current) {
      setMaxHpInput(combatant.hpMax.toString());
    }
  }, [combatant.hpMax, isHpPopoverOpen]);

  useEffect(() => {
    if (!isHpPopoverOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHpPopoverOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        hpPopoverRef.current &&
        !hpPopoverRef.current.contains(e.target as Node) &&
        hpButtonRef.current &&
        !hpButtonRef.current.contains(e.target as Node)
      ) {
        setIsHpPopoverOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isHpPopoverOpen]);

  useEffect(() => {
    if (!isConditionPickerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsConditionPickerOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        conditionPickerRef.current &&
        !conditionPickerRef.current.contains(e.target as Node) &&
        conditionTriggerRef.current &&
        !conditionTriggerRef.current.contains(e.target as Node)
      ) {
        setIsConditionPickerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isConditionPickerOpen]);

  const handleRemoveCondition = (conditionText: string) => {
    if (onRemoveCondition) {
      onRemoveCondition(combatant.id, conditionText);
    }
  };

  const handleApplyDamage = () => {
    if (!canEdit) return;
    const val = parseInt(damageAmount, 10);
    if (isNaN(val) || val <= 0) return;

    if (isConcentrating(combatant)) {
      const dc = calculateConcentrationDC(val);
      setLocalConcentrationAlert({ dc, expiresAt: Date.now() + 6000 });
      setTimeout(() => {
        setLocalConcentrationAlert((prev) =>
          prev && prev.expiresAt <= Date.now() ? null : prev
        );
      }, 6000);
    }

    const currentThp = combatant.tempHp ?? combatant.hpTemp ?? 0;
    if (currentThp > 0 && onSaveThp) {
      const remThp = Math.max(0, currentThp - val);
      onSaveThp(combatant.id, remThp);
      const remDmg = Math.max(0, val - currentThp);
      if (remDmg > 0) {
        onHpDelta(combatant.id, -remDmg);
      }
    } else {
      onHpDelta(combatant.id, -val);
    }

    setDamageAmount('');
  };

  const handleApplyHeal = () => {
    if (!canEdit) return;
    const val = parseInt(healAmount, 10);
    if (isNaN(val) || val <= 0) return;
    onHpDelta(combatant.id, val);
    setHealAmount('');
  };

  const handleApplySetMax = () => {
    if (!canEdit) return;
    const val = parseInt(maxHpInput, 10);
    if (isNaN(val) || val < 1) return;

    if (onUpdateMaxHp) {
      onUpdateMaxHp(combatant.id, val);
    }
    if (combatant.hpCurrent > val) {
      const excess = combatant.hpCurrent - val;
      onHpDelta(combatant.id, -excess);
    }
  };

  // Inline THP management handlers
  const [localThpOpen, setLocalThpOpen] = useState(false);
  const [localThpVal, setLocalThpVal] = useState<number>(
    combatant.tempHp ?? combatant.hpTemp ?? 0
  );

  const isThpEditing =
    inlineThpId !== undefined ? inlineThpId === combatant.id : localThpOpen;
  const currentThpVal =
    inlineThpVal !== undefined && isThpEditing ? inlineThpVal : localThpVal;

  const handleSaveThp = () => {
    if (onSaveInlineThp && inlineThpId === combatant.id) {
      onSaveInlineThp(combatant.id);
    } else if (onSaveThp) {
      onSaveThp(combatant.id, currentThpVal);
      setLocalThpOpen(false);
    } else {
      setLocalThpOpen(false);
    }
  };

  const handleCancelThp = () => {
    if (setInlineThpId) {
      setInlineThpId(null);
    }
    setLocalThpOpen(false);
  };

  const handleOpenThp = () => {
    if (!canEdit) return;
    if (setInlineThpId && setInlineThpVal) {
      setInlineThpId(combatant.id);
      setInlineThpVal(combatant.tempHp ?? combatant.hpTemp ?? 0);
    } else {
      setLocalThpVal(combatant.tempHp ?? combatant.hpTemp ?? 0);
      setLocalThpOpen(true);
    }
  };

  // Death Save Pip Handler for PC and Ally at 0 HP
  const handleToggleDeathSave = (type: 'successes' | 'failures', pipIndex: number) => {
    if (!canEdit) return;
    const current = combatant.deathSaves || { successes: 0, failures: 0 };
    const currentVal = current[type];
    const nextVal = currentVal === pipIndex ? pipIndex - 1 : pipIndex;
    const updatedSaves = {
      ...current,
      [type]: Math.max(0, Math.min(3, nextVal)),
    };
    onUpdateDeathSaves?.(combatant.id, updatedSaves);
    onUpdateCombatant?.(combatant.id, { deathSaves: updatedSaves });
  };

  const roleCfg = ROLE_CONFIG[combatant.type] || ROLE_CONFIG.player;
  const isPcOrAllyAtZeroHp = isPlayerOrAlly && combatant.hpCurrent === 0;

  return (
    <div
      className={`rounded-lg border border-l-[3px] transition-all text-xs select-none relative ${
        roleCfg.borderL
      } ${
        isReserve ? 'border-dashed opacity-75' : ''
      } ${
        isActionMenuOpen ? 'ring-1 ring-amber-400/50' : ''
      } ${
        isActive
          ? 'bg-amber-950/30 border-amber-500/80 shadow-md ring-2 ring-amber-400/40'
          : 'bg-slate-900/85 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Active Turn reminder tags pulsing at top for GM */}
      {isActive && timingReminders.length > 0 && (
        <div className="absolute -top-2.5 left-8 z-20 flex items-center gap-1">
          {timingReminders.map((rem) => (
            <span
              key={rem.id}
              className={`px-1.5 py-0.2 rounded-full text-[9px] font-bold border shadow-sm animate-pulse flex items-center gap-0.5 ${
                rem.timing === 'start'
                  ? 'bg-amber-400 text-neutral-950 border-amber-300'
                  : 'bg-sky-400 text-neutral-950 border-sky-300'
              }`}
            >
              <Clock className="w-2.5 h-2.5" />
              <span>
                {rem.name} ⏱ {rem.timing === 'start' ? 'Start' : 'End'}
              </span>
            </span>
          ))}
        </div>
      )}

      {/* 1. HIGH-DENSITY PRIMARY ROW (~38px height) */}
      <div className="min-h-[38px] px-2 py-1 flex items-center justify-between gap-1.5">
        {/* Left: Initiative badge & role accent */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => canEdit && onRollInitiative?.(combatant.id)}
            disabled={!canEdit}
            title={canEdit ? 'Click to roll 1d20 Initiative' : `Initiative ${combatant.initiative}`}
            className="w-7 h-7 font-black text-xs rounded-lg bg-neutral-800 text-amber-400 flex items-center justify-center tabular-nums border border-neutral-700 hover:border-amber-400 transition cursor-pointer shadow-inner disabled:cursor-default"
          >
            {combatant.initiative}
          </button>
        </div>

        {/* Center: Combatant name, AC badge, Role pill, Health state pill */}
        <div className="flex-1 min-w-0 flex items-center gap-1.5 truncate">
          <span
            className={`font-bold text-xs truncate max-w-[110px] ${
              isActive ? 'text-amber-300 font-black' : 'text-slate-200'
            }`}
            title={combatant.name}
          >
            {combatant.name}
          </span>

          {/* AC Badge */}
          {isDm || !isUnderFoW ? (
            <span
              className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-950 text-cyan-300 border border-slate-700/80 flex items-center gap-0.5 shrink-0 shadow-sm"
              title={`Armor Class: ${effectiveAcInfo.effectiveAc}`}
            >
              <span>🛡️</span>
              <span>{effectiveAcInfo.effectiveAc}</span>
            </span>
          ) : (
            <span
              className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-950 text-slate-500 border border-slate-800 flex items-center gap-0.5 shrink-0"
              title="Armor Class hidden"
            >
              <span>🛡️</span>
              <span>?</span>
            </span>
          )}

          {/* Role Pill */}
          <span
            className={`px-1.5 py-0.2 rounded text-[9px] font-bold border flex items-center gap-0.5 shrink-0 ${roleCfg.badge}`}
          >
            {roleCfg.icon}
            <span>
              {combatant.type === 'custom' && combatant.customRoleLabel
                ? combatant.customRoleLabel
                : roleCfg.label}
            </span>
          </span>

          {/* Linked Ally Badge */}
          {(combatant.linkedPcId || combatant.linkedPcName) && (
            <span
              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 flex items-center gap-0.5 shrink-0 shadow-sm"
              title={`Linked to PC: ${combatant.linkedPcName || 'PC'}`}
            >
              <LinkIcon className="w-2.5 h-2.5 text-emerald-400" />
              <span className="truncate max-w-[80px]">
                {combatant.linkedPcName ? `🔗 ${combatant.linkedPcName}` : '🔗 Linked'}
              </span>
            </span>
          )}

          {/* Dynamic Health State Pill */}
          {(isDm || !isUnderFoW) && (
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border shrink-0 ${health.badgeClass}`}
              title={`HP Status: ${health.badgeLabel} (${health.percentage}%)`}
            >
              {health.badgeLabel}
            </span>
          )}

          {/* Concentration Damage Alert Badge */}
          {activeConcentrationAlert && (
            <span
              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/60 flex items-center gap-0.5 animate-pulse shrink-0"
              title={`Concentration Check DC ${activeConcentrationAlert.dc}`}
            >
              <span>⚡ CON DC {activeConcentrationAlert.dc}</span>
            </span>
          )}

          {isConcentrating(combatant) && !activeConcentrationAlert && (
            <span className="text-cyan-400 shrink-0 animate-pulse" title="Concentrating">
              <Zap className="w-3 h-3 fill-current" />
            </span>
          )}
        </div>

        {/* Right: Clickable HP Value + Chevron Toggle */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Clickable HP button */}
          {!isDm && isUnderFoW ? (
            <span className="font-mono font-bold text-xs text-slate-400 px-1 py-0.5 rounded bg-slate-900 border border-slate-800 tabular-nums">
              ???/???
            </span>
          ) : (
            <div className="relative">
              <button
                ref={hpButtonRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit) setIsHpPopoverOpen((prev) => !prev);
                }}
                disabled={!canEdit}
                className="font-mono font-bold text-xs hover:text-amber-400 px-1 py-0.5 rounded bg-slate-900 border border-slate-800 tabular-nums transition-colors cursor-pointer text-slate-200"
                title={canEdit ? 'Click to manage HP (Damage, Heal, Set Max)' : `HP: ${localHp}/${combatant.hpMax}`}
              >
                {localHp}/{combatant.hpMax}
              </button>

              {/* INLINE QUICK HP POPOVER (Anchored right below HP button) */}
              {isHpPopoverOpen && canEdit && (
                <div
                  ref={hpPopoverRef}
                  className="absolute right-0 top-full mt-1 bg-slate-900 border border-slate-700/80 rounded-lg shadow-2xl p-2.5 z-50 flex flex-col gap-2 min-w-[220px] text-xs text-slate-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="font-bold truncate text-slate-200">
                        {combatant.name} HP
                      </span>
                      <span className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border shrink-0 ${health.badgeClass}`}>
                        {health.badgeLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHpPopoverOpen(false)}
                      className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                      title="Close"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Damage */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      placeholder="Damage"
                      value={damageAmount}
                      onChange={(e) => setDamageAmount(e.target.value)}
                      onFocus={() => {
                        isInputFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        isInputFocusedRef.current = false;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyDamage();
                        }
                      }}
                      className="flex-1 min-w-0 px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-rose-400 text-center"
                    />
                    <button
                      type="button"
                      onClick={handleApplyDamage}
                      disabled={!damageAmount || parseInt(damageAmount, 10) <= 0}
                      className="px-2.5 py-1 text-xs font-bold rounded bg-rose-900/90 hover:bg-rose-800 border border-rose-700 text-rose-200 hover:text-white transition cursor-pointer disabled:opacity-40 shadow-sm shrink-0"
                    >
                      Damage
                    </button>
                  </div>

                  {/* Heal */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="1"
                      placeholder="Heal"
                      value={healAmount}
                      onChange={(e) => setHealAmount(e.target.value)}
                      onFocus={() => {
                        isInputFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        isInputFocusedRef.current = false;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplyHeal();
                        }
                      }}
                      className="flex-1 min-w-0 px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-400 text-center"
                    />
                    <button
                      type="button"
                      onClick={handleApplyHeal}
                      disabled={!healAmount || parseInt(healAmount, 10) <= 0}
                      className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 hover:text-white transition cursor-pointer disabled:opacity-40 shadow-sm shrink-0"
                    >
                      Heal
                    </button>
                  </div>

                  {/* Set Max */}
                  <div className="flex items-center gap-1.5 pt-1.5 border-t border-slate-800">
                    <input
                      type="number"
                      min="1"
                      placeholder="Max HP"
                      value={maxHpInput}
                      onChange={(e) => setMaxHpInput(e.target.value)}
                      onFocus={() => {
                        isInputFocusedRef.current = true;
                      }}
                      onBlur={() => {
                        isInputFocusedRef.current = false;
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleApplySetMax();
                        }
                      }}
                      className="flex-1 min-w-0 px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-400 text-center"
                    />
                    <button
                      type="button"
                      onClick={handleApplySetMax}
                      className="px-2.5 py-1 text-xs font-semibold rounded bg-blue-600 hover:bg-blue-500 border border-blue-400/80 text-white transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0"
                    >
                      <Check className="w-3 h-3" />
                      <span>Set Max</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Chevron Toggle Button */}
          <button
            type="button"
            onClick={() => onToggleExpand(combatant.id)}
            className="p-1 text-slate-400 hover:text-slate-200 transition cursor-pointer rounded hover:bg-slate-800"
            title={isExpanded ? 'Collapse Row' : 'Expand Tactical Controls'}
            aria-label={isExpanded ? 'Collapse Row' : 'Expand Tactical Controls'}
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. EXPANDED TACTICAL CONTROLS VIEW (Unfolded when isExpanded is true) */}
      {isExpanded && (
        <div className="px-2 pb-2 pt-1 border-t border-slate-800/80 space-y-2 bg-slate-950/40 rounded-b-lg">
          {/* Tactical HP Controls Row: Quick Tally Buttons, THP, Death Saves */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Death Saves or Tally Buttons */}
            {isPcOrAllyAtZeroHp ? (
              <div
                className="flex items-center gap-1 bg-slate-950/90 px-1.5 py-0.5 rounded-lg border border-slate-800 shadow-sm"
                title="Death Saves: Click pips to toggle"
              >
                <div className="flex items-center gap-0.5">
                  <span className="text-[8px] font-bold text-emerald-400 mr-0.5">S:</span>
                  {[1, 2, 3].map((pip) => {
                    const isFilled = (combatant.deathSaves?.successes ?? 0) >= pip;
                    return (
                      <button
                        key={`succ-${pip}`}
                        type="button"
                        onClick={() => handleToggleDeathSave('successes', pip)}
                        className={`w-3.5 h-3.5 rounded-full border transition cursor-pointer flex items-center justify-center ${
                          isFilled
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-sm'
                            : 'border-slate-600 bg-slate-900 hover:border-emerald-500'
                        }`}
                        title={`Death Save Success ${pip}`}
                      >
                        {isFilled && <span className="text-[8px] font-black leading-none">✓</span>}
                      </button>
                    );
                  })}
                </div>

                <div className="h-3 w-px bg-slate-800 mx-0.5" />

                <div className="flex items-center gap-0.5">
                  <span className="text-[8px] font-bold text-rose-400 mr-0.5">F:</span>
                  {[1, 2, 3].map((pip) => {
                    const isFilled = (combatant.deathSaves?.failures ?? 0) >= pip;
                    return (
                      <button
                        key={`fail-${pip}`}
                        type="button"
                        onClick={() => handleToggleDeathSave('failures', pip)}
                        className={`w-3.5 h-3.5 rounded-full border transition cursor-pointer flex items-center justify-center ${
                          isFilled
                            ? 'bg-rose-500 border-rose-400 text-slate-950 shadow-sm'
                            : 'border-slate-600 bg-slate-900 hover:border-rose-500'
                        }`}
                        title={`Death Save Failure ${pip}`}
                      >
                        {isFilled && <span className="text-[8px] font-black leading-none">✕</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickHpAdjust(-5)}
                  disabled={!canEdit}
                  className="h-6 px-1.5 rounded bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-700 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                  title="-5 HP"
                >
                  -5
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickHpAdjust(-1)}
                  disabled={!canEdit}
                  className="h-6 px-1.5 rounded bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-700 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                  title="-1 HP"
                >
                  -1
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickHpAdjust(1)}
                  disabled={!canEdit}
                  className="h-6 px-1.5 rounded bg-slate-800 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-700 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                  title="+1 HP"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickHpAdjust(5)}
                  disabled={!canEdit}
                  className="h-6 px-1.5 rounded bg-slate-800 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-700 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
                  title="+5 HP"
                >
                  +5
                </button>
              </div>
            )}

            {/* THP Editor / Badge */}
            <div className="flex items-center gap-1">
              {isThpEditing ? (
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    value={currentThpVal}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10) || 0;
                      if (setInlineThpVal) setInlineThpVal(val);
                      setLocalThpVal(val);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveThp();
                      if (e.key === 'Escape') handleCancelThp();
                    }}
                    autoFocus
                    className="w-10 px-1 py-0.5 text-[10px] font-mono rounded bg-slate-950 border border-cyan-500 text-cyan-300 text-center"
                  />
                  <button
                    type="button"
                    onClick={handleSaveThp}
                    className="p-0.5 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                    title="Save THP"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelThp}
                    className="p-0.5 text-slate-400 hover:text-slate-300 cursor-pointer"
                    title="Cancel"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenThp}
                  disabled={!canEdit}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition cursor-pointer ${
                    (combatant.tempHp ?? combatant.hpTemp ?? 0) > 0
                      ? 'text-cyan-300 bg-cyan-950/80 border-cyan-600/70 hover:bg-cyan-900/80'
                      : 'text-slate-400 bg-slate-900 border-slate-800 hover:text-slate-200'
                  }`}
                  title={canEdit ? 'Click to edit Temp HP (+THP)' : `Temp HP: ${combatant.tempHp ?? combatant.hpTemp ?? 0}`}
                >
                  +{(combatant.tempHp ?? combatant.hpTemp ?? 0)} THP
                </button>
              )}

              {/* GM Priority Reorder Arrows */}
              {isDm && onMoveCombatant && (
                <div className="flex items-center gap-0.5 ml-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => onMoveCombatant(combatant.id, -1)}
                    className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-20 hover:bg-slate-800 rounded transition cursor-pointer"
                    title="Move Up (^)"
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === totalVisible - 1}
                    onClick={() => onMoveCombatant(combatant.id, 1)}
                    className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-20 hover:bg-slate-800 rounded transition cursor-pointer"
                    title="Move Down (v)"
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>
              )}

              {/* Three-dots Action Menu */}
              <button
                type="button"
                onClick={() => onToggleActionMenu(combatant.id)}
                className={`h-6 w-6 rounded-lg flex items-center justify-center border transition cursor-pointer ml-1 ${
                  combatant.conditions.length > 0 || isActionMenuOpen
                    ? 'bg-amber-950/70 border-amber-600/70 text-amber-300'
                    : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
                title="Edit Stats, Conditions, Minion Duplicate & Delete"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Active Conditions Row & Freeform Condition Quick-Fill Trigger */}
          {(visibleConditions.length > 0 || (canEdit && onAddCondition)) && (
            <div className="flex items-center gap-1 flex-wrap pt-1 border-t border-slate-800/60 relative">
              {visibleConditions.map((cond) => {
                const hasTiming = cond.timing === 'start' || cond.timing === 'end';
                return (
                  <span
                    key={cond.id || cond.name}
                    className={`text-[10px] bg-slate-800 text-slate-200 border border-slate-700 px-1.5 py-0.5 rounded-md flex items-center gap-1 font-medium ${getConditionBadgeStyle(
                      cond.name
                    )} ${
                      hasTiming && isActive ? 'ring-1 ring-amber-400/80 animate-pulse' : ''
                    } ${
                      cond.isSecret
                        ? 'border-dashed border-rose-500/90 bg-rose-950/80 text-rose-300'
                        : ''
                    }`}
                    title={`${cond.name}${hasTiming ? ` (Timing: ${cond.timing})` : ''}`}
                  >
                    {cond.isSecret && <EyeOff className="w-2.5 h-2.5 text-rose-400" />}
                    <span>{cond.name}</span>
                    {hasTiming && (
                      <span className="font-mono text-[8px] opacity-90 px-1 py-0.1 rounded bg-black/40 border border-white/10 ml-0.5">
                        ⏱ {cond.timing === 'start' ? 'Start' : 'End'}
                      </span>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveCondition(cond.name);
                        }}
                        className="text-slate-400 hover:text-rose-400 font-bold ml-0.5 cursor-pointer leading-none"
                        title={`Remove ${cond.name}`}
                      >
                        ✕
                      </button>
                    )}
                  </span>
                );
              })}

              {/* Freeform Condition Quick-Fill Trigger */}
              {canEdit && onAddCondition && (
                <div className="relative">
                  <button
                    ref={conditionTriggerRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsConditionPickerOpen((prev) => !prev);
                    }}
                    className="text-[10px] bg-slate-900 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-amber-600/50 hover:border-amber-500/80 px-1.5 py-0.5 rounded-md flex items-center gap-1 font-semibold transition cursor-pointer"
                    title="Add Condition (Freeform & Presets)"
                  >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Condition</span>
                  </button>

                  {/* Popover */}
                  {isConditionPickerOpen && (
                    <div
                      ref={conditionPickerRef}
                      className="absolute left-0 top-full mt-1.5 bg-slate-950 border border-slate-700/90 rounded-lg shadow-2xl p-2.5 z-50 min-w-[270px] max-w-[320px] text-xs text-slate-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ConditionPicker
                        title={`Conditions: ${combatant.name}`}
                        onApplyCondition={(text) => {
                          if (onAddCondition) {
                            onAddCondition(combatant.id, text);
                          }
                          setIsConditionPickerOpen(false);
                        }}
                        onClose={() => setIsConditionPickerOpen(false)}
                        activeConditions={visibleConditions.map((c) => c.name)}
                        isDm={isDm}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const CombatantRow = React.memo(
  CombatantRowInner,
  (prev, next) => {
    // 1. Compare isActive and row expansion / action menu state
    if (prev.isActive !== next.isActive) return false;
    if (prev.isExpanded !== next.isExpanded) return false;
    if (prev.isActionMenuOpen !== next.isActionMenuOpen) return false;
    if (prev.isDm !== next.isDm) return false;
    if (prev.concentrationAlert?.dc !== next.concentrationAlert?.dc) return false;
    if (prev.inlineThpId !== next.inlineThpId) return false;
    if (prev.inlineThpVal !== next.inlineThpVal) return false;

    // 2. Core combatant fields comparison
    const p = prev.combatant;
    const n = next.combatant;
    if (p.id !== n.id) return false;
    if (p.initiative !== n.initiative) return false;
    if (p.hpCurrent !== n.hpCurrent || (p.hp ?? 0) !== (n.hp ?? 0)) return false;
    if (p.hpMax !== n.hpMax || (p.maxHp ?? 0) !== (n.maxHp ?? 0)) return false;
    if ((p.tempHp ?? p.hpTemp ?? 0) !== (n.tempHp ?? n.hpTemp ?? 0)) return false;
    if (p.name !== n.name || p.type !== n.type || p.role !== n.role) return false;
    if (p.linkedPcId !== n.linkedPcId || p.linkedPcName !== n.linkedPcName) return false;
    if (p.hidden !== n.hidden || p.isReserve !== n.isReserve || p.maskStats !== n.maskStats) return false;
    if (
      p.deathSaves?.successes !== n.deathSaves?.successes ||
      p.deathSaves?.failures !== n.deathSaves?.failures
    ) {
      return false;
    }

    // 3. Conditions comparison
    const pConds = p.conditions || [];
    const nConds = n.conditions || [];
    if (pConds.length !== nConds.length) return false;
    for (let i = 0; i < pConds.length; i++) {
      const pc = pConds[i];
      const nc = nConds[i];
      const pName = typeof pc === 'string' ? pc : pc.name;
      const nName = typeof nc === 'string' ? nc : nc.name;
      if (pName !== nName) return false;
    }

    return true;
  }
);

export default CombatantRow;

