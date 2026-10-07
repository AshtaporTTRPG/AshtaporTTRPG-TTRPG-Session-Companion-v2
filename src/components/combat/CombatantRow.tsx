import React, { useState, useEffect, useRef } from 'react';
import {
  Combatant,
  CombatantType,
  CustomCondition,
  isCombatantFoW,
  getEffectiveAc,
} from '../../types/ttrpg';
import { getHealthThreshold } from '../../utils/combatHealth';
import { isConcentrating } from '../../utils/concentration';
import OBR from '@owlbear-rodeo/sdk';
import {
  Heart,
  Crosshair,
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
} from 'lucide-react';

export interface CombatantRowProps {
  combatant: Combatant;
  index: number;
  totalVisible: number;
  isActive: boolean;
  isDm: boolean;
  playerName?: string;
  isActionMenuOpen: boolean;
  onToggleActionMenu: (combatantId: string) => void;
  onRollInitiative?: (combatantId: string) => void;
  onMoveCombatant?: (combatantId: string, direction: -1 | 1) => void;
  onHpDelta: (combatantId: string, delta: number) => void;
  onUpdateMaxHp?: (combatantId: string, newMaxHp: number) => void;
  onUpdateTokenId?: (combatantId: string, tokenId: string) => void;
  onSaveThp?: (combatantId: string, thp: number) => void;
  onRemoveCondition?: (combatantId: string, condIdOrName: string) => void;
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
    };
  }
  return {
    id: c.id || `cond-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: c.name || '',
    isSecret: !!c.isSecret,
    turnsLeft: c.turnsLeft,
  };
};

const getConditionBadgeStyle = (name: string): string => {
  if (name.includes('+2 AC')) return 'bg-cyan-950/90 border-cyan-500/80 text-cyan-300 font-bold';
  if (name.includes('+5 AC')) return 'bg-blue-950/90 border-blue-500/80 text-blue-300 font-bold';
  switch (name) {
    case 'Concentration':
      return 'bg-cyan-950/90 border-cyan-500/80 text-cyan-300';
    case 'Poisoned':
      return 'bg-emerald-950/90 border-emerald-500/80 text-emerald-300';
    case 'Prone':
      return 'bg-amber-950/90 border-amber-500/80 text-amber-300';
    case 'Blinded':
    case 'Deafened':
      return 'bg-slate-800 border-slate-600 text-slate-300';
    case 'Charmed':
    case 'Frightened':
      return 'bg-purple-950/90 border-purple-500/80 text-purple-300';
    case 'Paralyzed':
    case 'Petrified':
    case 'Stunned':
    case 'Incapacitated':
      return 'bg-yellow-950/90 border-yellow-500/80 text-yellow-300';
    case 'Grappled':
    case 'Restrained':
      return 'bg-blue-950/90 border-blue-500/80 text-blue-300';
    case 'Unconscious':
      return 'bg-rose-950/90 border-rose-600/80 text-rose-300';
    case 'Exhaustion':
      return 'bg-orange-950/90 border-orange-500/80 text-orange-300';
    default:
      return 'bg-slate-800 border-slate-700 text-slate-300';
  }
};

const getTypeBadge = (type: CombatantType, customLabel?: string) => {
  switch (type) {
    case 'player':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-cyan-950/80 border border-cyan-600/80 text-cyan-300 flex items-center gap-0.5 shrink-0">
          <User className="w-2.5 h-2.5" />
          <span>PC</span>
        </span>
      );
    case 'ally':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-950/80 border border-emerald-600/80 text-emerald-300 flex items-center gap-0.5 shrink-0">
          <Users className="w-2.5 h-2.5" />
          <span>Ally</span>
        </span>
      );
    case 'monster':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950/80 border border-rose-800/80 text-rose-300 flex items-center gap-0.5 shrink-0">
          <Skull className="w-2.5 h-2.5 text-rose-400" />
          <span>Monster</span>
        </span>
      );
    case 'boss':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-950/80 border border-rose-600/80 text-rose-300 flex items-center gap-0.5 shrink-0">
          <Crown className="w-2.5 h-2.5 text-rose-400" />
          <span>Boss</span>
        </span>
      );
    case 'custom':
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-950/80 border border-amber-600/80 text-amber-300 flex items-center gap-0.5 shrink-0">
          <Layers className="w-2.5 h-2.5 text-amber-400" />
          <span>{customLabel || 'Custom'}</span>
        </span>
      );
    default:
      return (
        <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-800 border border-slate-700 text-slate-300 shrink-0">
          NPC
        </span>
      );
  }
};

export const CombatantRow: React.FC<CombatantRowProps> = ({
  combatant,
  index,
  totalVisible,
  isActive,
  isDm,
  playerName,
  isActionMenuOpen,
  onToggleActionMenu,
  onRollInitiative,
  onMoveCombatant,
  onHpDelta,
  onUpdateMaxHp,
  onUpdateTokenId,
  onSaveThp,
  onRemoveCondition,
  concentrationAlert,
  inlineThpId,
  setInlineThpId,
  inlineThpVal,
  setInlineThpVal,
  onSaveInlineThp,
}) => {
  // Fog of War & Role Access Security
  const isUnderFoW = isCombatantFoW(combatant);
  const isPlayerOrAlly = combatant.type === 'player' || combatant.type === 'ally';

  // Role gating:
  // GM can edit everything.
  // Players can only edit PC/Ally combatants that are not FoW-masked.
  // If playerName is assigned, ensure players only edit their own or party PCs.
  const isAssignedPlayer =
    !isDm &&
    playerName &&
    playerName.trim().length > 0 &&
    combatant.name.trim().toLowerCase() === playerName.trim().toLowerCase();

  const canEdit =
    isDm ||
    (isPlayerOrAlly && !isUnderFoW && (!playerName || isAssignedPlayer || combatant.type === 'player'));

  const health = getHealthThreshold(combatant.hpCurrent, combatant.hpMax);
  const effectiveAcInfo = getEffectiveAc(combatant);

  const visibleConditions = combatant.conditions
    .map(normalizeCondition)
    .filter((cond) => isDm || !cond.isSecret);

  // Crosshair / Token Focus State
  const [tokenStatusTooltip, setTokenStatusTooltip] = useState<string | null>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Quick HP Popover State
  const [isHpPopoverOpen, setIsHpPopoverOpen] = useState<boolean>(false);
  const [quickHpAmount, setQuickHpAmount] = useState<string>('');
  const [draftMaxHp, setDraftMaxHp] = useState<number>(combatant.hpMax);
  const hpPopoverRef = useRef<HTMLDivElement>(null);

  // Keep draft max HP synced with props
  useEffect(() => {
    setDraftMaxHp(combatant.hpMax);
  }, [combatant.hpMax]);

  // Clean up tooltip timeout
  useEffect(() => {
    return () => {
      if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    };
  }, []);

  // Quick HP Popover Escape & Click-Outside Handlers
  useEffect(() => {
    if (!isHpPopoverOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsHpPopoverOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (hpPopoverRef.current && !hpPopoverRef.current.contains(e.target as Node)) {
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

  // Dedicated Tooltip Display
  const showTooltip = (msg: string) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    setTokenStatusTooltip(msg);
    tooltipTimeoutRef.current = setTimeout(() => {
      setTokenStatusTooltip(null);
    }, 2000);
  };

  // Crosshair / Map Focus Bug Fix:
  // 1. Look up item by ID: getItems([combatant.tokenId])
  // 2. Name Fallback: If not found or tokenId is missing, match by name from scene items
  // 3. Target Found: Persist tokenId, animateTo position, select token
  // 4. Target Not Found: NEVER call animateTo. Show 2-second tooltip: "Token not found on scene"
  const handleFocusToken = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!OBR.isReady) {
      showTooltip('Owlbear Rodeo not ready');
      return;
    }

    try {
      let targetItem: any = null;

      // 1. Look up item by ID
      if (combatant.tokenId) {
        try {
          const items = await OBR.scene.items.getItems([combatant.tokenId]);
          if (items && items.length > 0 && items[0]?.position) {
            targetItem = items[0];
          }
        } catch (err) {
          console.warn('Could not retrieve item by tokenId:', err);
        }
      }

      // 2. Name Fallback: If not found or tokenId is missing
      if (!targetItem) {
        try {
          const sceneItems = await OBR.scene.items.getItems();
          const match = sceneItems.find(
            (item) => item.name?.trim().toLowerCase() === combatant.name.trim().toLowerCase()
          );
          if (match && match.position) {
            targetItem = match;
            // Update and persist combatant.tokenId = match.id
            if (onUpdateTokenId) {
              onUpdateTokenId(combatant.id, match.id);
            }
          }
        } catch (err) {
          console.warn('Could not search scene items by name:', err);
        }
      }

      // 3. Target Found: Smoothly center & select
      if (targetItem && targetItem.position) {
        const scale = await OBR.viewport.getScale().catch(() => 1);
        await OBR.viewport.animateTo({ position: targetItem.position, scale });
        await OBR.player.select([targetItem.id]);
      } else {
        // 4. Target Not Found: Safety Guardrail! Never call animateTo
        showTooltip('Token not found on scene');
      }
    } catch (err) {
      console.warn('Error focusing token on map:', err);
      showTooltip('Token not found on scene');
    }
  };

  // Quick HP Popover Handlers
  const handlePopoverDamage = () => {
    if (!canEdit) return;
    const val = parseInt(quickHpAmount, 10);
    if (isNaN(val) || val <= 0) return;
    onHpDelta(combatant.id, -val);
    setQuickHpAmount('');
  };

  const handlePopoverHeal = () => {
    if (!canEdit) return;
    const val = parseInt(quickHpAmount, 10);
    if (isNaN(val) || val <= 0) return;
    onHpDelta(combatant.id, val);
    setQuickHpAmount('');
  };

  const handlePopoverSetMax = () => {
    if (!canEdit) return;
    const val = draftMaxHp;
    if (isNaN(val) || val < 1) return;
    if (onUpdateMaxHp) {
      onUpdateMaxHp(combatant.id, val);
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

  return (
    <div
      className={`min-h-[56px] py-1.5 px-2.5 rounded-xl border transition-all flex items-center justify-between gap-2 text-xs select-none relative ${
        isActionMenuOpen ? 'ring-1 ring-amber-400/50' : ''
      } ${
        isActive
          ? 'bg-amber-950/30 border-amber-500/80 shadow-md border-l-4 border-l-amber-400 ring-1 ring-amber-400/20'
          : 'bg-slate-900/85 border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* COL 1: Initiative Badge & Priority Reorder Arrows */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => canEdit && onRollInitiative?.(combatant.id)}
          disabled={!canEdit}
          title={canEdit ? 'Click to roll 1d20 Initiative' : `Initiative ${combatant.initiative}`}
          className="w-8 h-8 font-bold text-xs rounded-lg bg-neutral-800 text-amber-400 flex items-center justify-center shrink-0 tabular-nums border border-neutral-700 hover:border-amber-400 transition cursor-pointer shadow-inner disabled:cursor-default"
        >
          {combatant.initiative}
        </button>

        {/* Priority Reordering Arrows (^ / v) for DM */}
        {isDm && onMoveCombatant && (
          <div className="flex flex-col gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMoveCombatant(combatant.id, -1)}
              className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-20 hover:bg-slate-800 rounded transition cursor-pointer"
              title="Move Up in Priority (^)"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={index === totalVisible - 1}
              onClick={() => onMoveCombatant(combatant.id, 1)}
              className="p-0.5 text-slate-400 hover:text-amber-300 disabled:opacity-20 hover:bg-slate-800 rounded transition cursor-pointer"
              title="Move Down in Priority (v)"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* COL 2: Identity, Defense, Status & Condition Chips */}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Combatant Name */}
          <span
            className={`font-bold truncate max-w-[110px] ${
              isActive ? 'text-amber-300' : 'text-slate-200'
            }`}
            title={combatant.name}
          >
            {combatant.name}
          </span>

          {/* Crosshair / Map Focus Icon with 2-second Tooltip */}
          <div className="relative inline-flex items-center">
            <button
              type="button"
              onClick={handleFocusToken}
              title="Focus Token on Map"
              className="p-0.5 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer shrink-0"
            >
              <Crosshair className="w-3.5 h-3.5" />
            </button>
            {tokenStatusTooltip && (
              <div className="absolute left-1/2 -translate-x-1/2 -top-7 px-2 py-0.5 rounded bg-rose-950 border border-rose-700 text-rose-200 text-[10px] font-medium whitespace-nowrap shadow-xl z-50 pointer-events-none animate-fadeIn">
                {tokenStatusTooltip}
              </div>
            )}
          </div>

          {/* Inline AC Shield Badge */}
          <span
            className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-slate-950 text-cyan-300 border border-slate-700/80 flex items-center gap-1 shrink-0 shadow-sm"
            title={`Armor Class: ${effectiveAcInfo.effectiveAc}${
              effectiveAcInfo.bonus > 0
                ? ` (Base ${combatant.ac ?? combatant.armorClass ?? 10} + ${effectiveAcInfo.bonus})`
                : ''
            }`}
          >
            <span>🛡️</span>
            <span>
              {effectiveAcInfo.bonus > 0
                ? `${effectiveAcInfo.effectiveAc} (+${effectiveAcInfo.bonus})`
                : `${effectiveAcInfo.effectiveAc} AC`}
            </span>
          </span>

          {/* Role Badge: PC / Monster / Boss / Ally / Custom */}
          {getTypeBadge(combatant.type, combatant.customRoleLabel)}

          {/* Dynamic Health Status Pill: Preserves FoW gating */}
          {(isDm || !isUnderFoW) && (
            <span
              className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border shrink-0 ${health.badgeClass}`}
              title={`Automated HP Status: ${health.badgeLabel} (${health.percentage}%)`}
            >
              {health.badgeLabel}
            </span>
          )}

          {/* Concentration Damage DC Alert Badge (⚡ CON DC [val]) */}
          {concentrationAlert && (
            <span
              className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/60 flex items-center gap-0.5 animate-pulse shrink-0"
              title={`Concentration Check DC ${concentrationAlert.dc} Required (took damage)`}
            >
              <span>⚡ CON DC {concentrationAlert.dc}</span>
            </span>
          )}

          {/* FoW / Secret marker for DM */}
          {isDm && (combatant.hidden || combatant.isSecret) && (
            <span
              className="px-1 py-0.2 rounded text-[9px] font-mono bg-rose-950/80 border border-rose-800/80 text-rose-300 shrink-0 flex items-center gap-0.5"
              title="Hidden/Secret FoW"
            >
              <EyeOff className="w-2.5 h-2.5" />
              <span>FoW</span>
            </span>
          )}

          {/* Concentration active indicator icon */}
          {isConcentrating(combatant) && !concentrationAlert && (
            <span
              className="text-cyan-400 shrink-0 animate-pulse"
              title="Concentrating"
            >
              <Zap className="w-3 h-3 fill-current" />
            </span>
          )}
        </div>

        {/* Inline Condition Chips Row with click-to-remove */}
        {visibleConditions.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap pt-0.5">
            {visibleConditions.map((cond) => (
              <span
                key={cond.id || cond.name}
                onClick={(e) => {
                  if (canEdit && onRemoveCondition) {
                    e.stopPropagation();
                    onRemoveCondition(combatant.id, cond.id || cond.name);
                  }
                }}
                className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border flex items-center gap-0.5 shrink-0 transition ${getConditionBadgeStyle(
                  cond.name
                )} ${
                  cond.isSecret
                    ? 'border-dashed border-rose-500/90 bg-rose-950/80 text-rose-300'
                    : ''
                } ${canEdit ? 'cursor-pointer hover:opacity-80' : ''}`}
                title={`${cond.name}${cond.isSecret ? ' (Secret GM condition)' : ''}${
                  canEdit ? ' (click to remove)' : ''
                }`}
              >
                {cond.isSecret && <EyeOff className="w-2.5 h-2.5 text-rose-400" />}
                <span>{cond.name}</span>
                {canEdit && <X className="w-2.5 h-2.5 opacity-60 hover:opacity-100" />}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* COL 3: Inline HP Controls with Quick HP Popover & Strict FoW Masking */}
      <div className="flex items-center gap-1 shrink-0">
        {!isDm && isUnderFoW ? (
          /* Strict Player FoW: Mask exact HP with ???/??? */
          <span
            className="text-[11px] font-mono font-bold text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 tabular-nums shadow-inner"
            title="Entity HP masked by Fog of War"
          >
            ???/???
          </span>
        ) : (
          <>
            {/* Micro damage buttons (-5, -1) */}
            <button
              type="button"
              onClick={() => onHpDelta(combatant.id, -5)}
              disabled={!canEdit}
              className="h-6 w-5 rounded bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-700 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
              title="-5 HP"
            >
              -5
            </button>
            <button
              type="button"
              onClick={() => onHpDelta(combatant.id, -1)}
              disabled={!canEdit}
              className="h-6 w-5 rounded bg-slate-800 hover:bg-rose-900 border border-slate-700 hover:border-rose-700 text-rose-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
              title="-1 HP"
            >
              -1
            </button>

            {/* Current / Max HP display: Click opens Inline Quick HP Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit) {
                    setIsHpPopoverOpen((prev) => !prev);
                  }
                }}
                disabled={!canEdit}
                className={`text-[11px] font-mono font-bold text-slate-200 tabular-nums px-1 py-0.5 rounded transition cursor-pointer min-w-[44px] text-center ${
                  isHpPopoverOpen
                    ? 'bg-slate-800 ring-1 ring-amber-400 text-amber-300'
                    : 'hover:bg-slate-800/80 hover:text-amber-300'
                } ${!canEdit ? 'cursor-default hover:bg-transparent hover:text-slate-200' : ''}`}
                title={canEdit ? 'Click to open Quick HP Management' : `HP: ${combatant.hpCurrent}/${combatant.hpMax}`}
              >
                <span
                  className={
                    combatant.hpCurrent <= combatant.hpMax * 0.5
                      ? 'text-amber-400'
                      : 'text-slate-100'
                  }
                >
                  {combatant.hpCurrent}
                </span>
                <span className="text-slate-500 font-normal text-[10px]">
                  /{combatant.hpMax}
                </span>
              </button>

              {/* INLINE QUICK HP POPOVER (Anchored below row, mirrors THP UX) */}
              {isHpPopoverOpen && canEdit && (
                <div
                  ref={hpPopoverRef}
                  className="absolute right-0 top-full mt-2 z-50 w-72 max-w-[calc(100vw-2rem)] bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2.5 text-xs text-slate-100 space-y-2.5 animate-fadeIn"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Heart className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span className="font-bold truncate text-slate-200">
                        {combatant.name} HP
                      </span>
                      <span
                        className={`text-[9px] font-semibold px-1.5 py-0.2 rounded border shrink-0 ${health.badgeClass}`}
                      >
                        {health.badgeLabel}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsHpPopoverOpen(false)}
                      className="text-slate-400 hover:text-slate-200 p-0.5 rounded hover:bg-slate-800 transition cursor-pointer"
                      title="Close (Escape)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* HP Bar & Metrics */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">
                        Current: <strong className="text-slate-100">{combatant.hpCurrent}</strong> / {combatant.hpMax}
                        {(combatant.tempHp ?? combatant.hpTemp ?? 0) > 0 && (
                          <span className="text-cyan-400 ml-1">
                            (+{(combatant.tempHp ?? combatant.hpTemp ?? 0)} THP)
                          </span>
                        )}
                      </span>
                      <span className="text-slate-400">{health.percentage}%</span>
                    </div>
                    <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                      <div
                        style={{
                          width: `${Math.min(
                            100,
                            (combatant.hpCurrent / Math.max(1, combatant.hpMax)) * 100
                          )}%`,
                        }}
                        className={`h-full transition-all duration-300 ${
                          health.status === 'Critical'
                            ? 'bg-rose-600'
                            : health.status === 'Bloodied'
                            ? 'bg-amber-500'
                            : health.status === 'Hurt'
                            ? 'bg-yellow-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Controls: Quick Damage & Heal */}
                  <div className="space-y-1.5">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Quick Damage / Heal
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        placeholder="Amount"
                        value={quickHpAmount}
                        onChange={(e) => setQuickHpAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handlePopoverDamage();
                          }
                        }}
                        className="flex-1 min-w-0 px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 text-center"
                      />
                      <button
                        type="button"
                        onClick={handlePopoverDamage}
                        disabled={!quickHpAmount || parseInt(quickHpAmount, 10) <= 0}
                        className="px-2.5 py-1 text-xs font-bold rounded bg-rose-950 hover:bg-rose-900 border border-rose-700/80 text-rose-200 hover:text-white transition cursor-pointer disabled:opacity-40 shadow-sm shrink-0"
                        title="Deal Damage (absorbs Temp HP first, triggers Concentration DC)"
                      >
                        Damage
                      </button>
                      <button
                        type="button"
                        onClick={handlePopoverHeal}
                        disabled={!quickHpAmount || parseInt(quickHpAmount, 10) <= 0}
                        className="px-2.5 py-1 text-xs font-bold rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-700/80 text-emerald-200 hover:text-white transition cursor-pointer disabled:opacity-40 shadow-sm shrink-0"
                        title="Apply Healing (capped at Max HP)"
                      >
                        Heal
                      </button>
                    </div>

                    {/* Quick tally chips inside popover */}
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="text-[10px] text-slate-500 font-mono">Dmg:</span>
                      <button
                        type="button"
                        onClick={() => onHpDelta(combatant.id, -1)}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-rose-700 text-rose-400 text-[10px] font-mono cursor-pointer"
                        title="-1 Damage"
                      >
                        -1
                      </button>
                      <button
                        type="button"
                        onClick={() => onHpDelta(combatant.id, -5)}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-rose-700 text-rose-400 text-[10px] font-mono cursor-pointer"
                        title="-5 Damage"
                      >
                        -5
                      </button>
                      <button
                        type="button"
                        onClick={() => onHpDelta(combatant.id, -10)}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-rose-700 text-rose-400 text-[10px] font-mono cursor-pointer"
                        title="-10 Damage"
                      >
                        -10
                      </button>

                      <div className="w-px h-3 bg-slate-800 mx-0.5" />

                      <span className="text-[10px] text-slate-500 font-mono">Heal:</span>
                      <button
                        type="button"
                        onClick={() => onHpDelta(combatant.id, 1)}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-emerald-700 text-emerald-400 text-[10px] font-mono cursor-pointer"
                        title="+1 Heal"
                      >
                        +1
                      </button>
                      <button
                        type="button"
                        onClick={() => onHpDelta(combatant.id, 5)}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-emerald-700 text-emerald-400 text-[10px] font-mono cursor-pointer"
                        title="+5 Heal"
                      >
                        +5
                      </button>
                      <button
                        type="button"
                        onClick={() => onHpDelta(combatant.id, 10)}
                        className="px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-emerald-700 text-emerald-400 text-[10px] font-mono cursor-pointer"
                        title="+10 Heal"
                      >
                        +10
                      </button>
                    </div>
                  </div>

                  {/* Section 2: Edit Max HP Direct */}
                  <div className="pt-2 border-t border-slate-800 space-y-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Edit Max HP
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="1"
                        value={draftMaxHp}
                        onChange={(e) => setDraftMaxHp(parseInt(e.target.value, 10) || 1)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handlePopoverSetMax();
                          }
                        }}
                        className="flex-1 min-w-0 px-2 py-1 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 text-center"
                      />
                      <button
                        type="button"
                        onClick={handlePopoverSetMax}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-amber-300 hover:text-amber-200 transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0"
                        title="Set new Max HP"
                      >
                        <Check className="w-3 h-3" />
                        <span>Set Max</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Existing Inline THP Block (+X THP) */}
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
                className={`text-[9px] font-mono px-1 py-0.5 rounded border transition cursor-pointer ${
                  (combatant.tempHp ?? combatant.hpTemp ?? 0) > 0
                    ? 'text-cyan-300 bg-cyan-950/80 border-cyan-600/70 hover:bg-cyan-900/80'
                    : 'text-slate-500 bg-slate-900 border-slate-800 hover:text-slate-300'
                }`}
                title={
                  canEdit
                    ? 'Click to edit Temp HP (+THP)'
                    : `Temp HP: ${combatant.tempHp ?? combatant.hpTemp ?? 0}`
                }
              >
                +{(combatant.tempHp ?? combatant.hpTemp ?? 0)} THP
              </button>
            )}

            {/* Micro heal buttons (+1, +5) */}
            <button
              type="button"
              onClick={() => onHpDelta(combatant.id, 1)}
              disabled={!canEdit}
              className="h-6 w-5 rounded bg-slate-800 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-700 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
              title="+1 HP"
            >
              +1
            </button>
            <button
              type="button"
              onClick={() => onHpDelta(combatant.id, 5)}
              disabled={!canEdit}
              className="h-6 w-5 rounded bg-slate-800 hover:bg-emerald-900 border border-slate-700 hover:border-emerald-700 text-emerald-300 font-mono text-[10px] font-bold flex items-center justify-center transition disabled:opacity-30 cursor-pointer"
              title="+5 HP"
            >
              +5
            </button>
          </>
        )}
      </div>

      {/* COL 4: Options Menu Toggle */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => onToggleActionMenu(combatant.id)}
          className={`h-7 w-7 rounded-lg flex items-center justify-center border transition cursor-pointer ${
            combatant.conditions.length > 0 || isActionMenuOpen
              ? 'bg-amber-950/70 border-amber-600/70 text-amber-300'
              : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
          title="Edit Stats & Conditions"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default CombatantRow;
