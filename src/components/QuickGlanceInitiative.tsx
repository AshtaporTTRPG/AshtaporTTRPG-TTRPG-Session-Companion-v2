import React from 'react';
import { Combatant, CombatantType, isCombatantFoW } from '../types/ttrpg';
import { ChevronUp, ChevronDown, Eye, EyeOff, Shield, Swords, Sparkles, Flame, User, Skull } from 'lucide-react';

interface QuickGlanceInitiativeProps {
  combatants: Combatant[];
  activeTurnIndex: number;
  activeCombatantId?: string | null;
  isDm: boolean;
  onSelectCombatant?: (index: number, combatantId?: string) => void;
  onMoveCombatant?: (fromIndex: number, toIndex: number) => void;
  onToggleVisibility?: (combatantId: string) => void;
}

const ROLE_BADGE_CONFIG: Record<
  CombatantType,
  { label: string; bg: string; text: string; border: string; icon: string }
> = {
  player: { label: 'PC', bg: 'bg-cyan-950/80', text: 'text-cyan-300', border: 'border-cyan-700/60', icon: '🛡️' },
  ally: { label: 'NPC', bg: 'bg-emerald-950/80', text: 'text-emerald-300', border: 'border-emerald-700/60', icon: '🤝' },
  monster: { label: 'Monster', bg: 'bg-rose-950/80', text: 'text-rose-300', border: 'border-rose-800/60', icon: '⚔️' },
  boss: { label: 'Boss', bg: 'bg-purple-950/90', text: 'text-amber-300', border: 'border-amber-500/70', icon: '👑' },
  custom: { label: 'Custom', bg: 'bg-amber-950/80', text: 'text-amber-300', border: 'border-amber-700/60', icon: '⚡' },
};

export const QuickGlanceInitiative: React.FC<QuickGlanceInitiativeProps> = ({
  combatants,
  activeTurnIndex,
  activeCombatantId,
  isDm,
  onSelectCombatant,
  onMoveCombatant,
  onToggleVisibility,
}) => {
  // Filter for player view: completely filter out and hide if hidden or secret
  const visibleItems = combatants
    .map((c, originalIndex) => ({ combatant: c, originalIndex }))
    .filter(({ combatant }) => isDm || (!combatant.hidden && !combatant.isSecret));

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col h-full space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Swords className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
            Initiative Order
          </h3>
        </div>
        <span className="text-[11px] font-mono text-slate-400">
          {visibleItems.length} active
        </span>
      </div>

      {/* Vertical List of Compact Combatant Tiles */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 min-h-[300px] max-h-[700px]">
        {visibleItems.length === 0 ? (
          <div className="text-center p-6 text-slate-500 text-xs italic">
            No combatants active.
          </div>
        ) : (
          visibleItems.map(({ combatant, originalIndex }, displayIdx) => {
            const isActive = activeCombatantId
              ? combatant.id === activeCombatantId
              : originalIndex === activeTurnIndex;
            const roleCfg = ROLE_BADGE_CONFIG[combatant.type] || ROLE_BADGE_CONFIG.player;
            const isFoW = isCombatantFoW(combatant);
            const isDefeated = (isDm || !isFoW) && combatant.hpCurrent <= 0 && combatant.hpMax > 0;

            return (
              <div
                key={combatant.id}
                onClick={() => onSelectCombatant && onSelectCombatant(originalIndex, combatant.id)}
                className={`group flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer select-none ${
                  isActive
                    ? 'bg-amber-950/40 border-amber-400 text-amber-200 shadow-md ring-1 ring-amber-400/50'
                    : isDefeated
                    ? 'bg-slate-950/40 border-slate-800/80 text-slate-500 opacity-60'
                    : 'bg-slate-950/70 border-slate-800/90 text-slate-200 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                {/* Left: Initiative Number & Name */}
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Initiative Score Badge */}
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 shadow-sm ${
                      isActive
                        ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300'
                        : `${roleCfg.bg} ${roleCfg.text} border ${roleCfg.border}`
                    }`}
                  >
                    {combatant.initiative}
                  </div>

                  {/* Name and Role Label */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-xs font-semibold truncate ${
                          isActive
                            ? 'text-amber-300 font-bold'
                            : isDefeated
                            ? 'line-through text-slate-500'
                            : 'text-slate-100'
                        }`}
                      >
                        {combatant.name}
                      </span>
                      {isActive && (
                        <span className="text-[10px] text-amber-400 font-bold animate-pulse">
                          ▶
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded border font-medium uppercase tracking-wider ${roleCfg.bg} ${roleCfg.text} ${roleCfg.border}`}
                      >
                        {combatant.type === 'custom' && combatant.customRoleLabel
                          ? combatant.customRoleLabel
                          : roleCfg.label}
                      </span>

                      {(combatant.hidden || combatant.isSecret) && isDm && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-purple-950/90 text-purple-300 border border-purple-600/80 flex items-center gap-1 shadow-sm">
                          <EyeOff className="w-2.5 h-2.5 text-purple-400" /> Hidden / Secret
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: DM Manual Reordering & Visibility Controls */}
                {isDm && (
                  <div
                    className="flex items-center gap-0.5 opacity-80 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Toggle Visibility */}
                    <button
                      type="button"
                      onClick={() => onToggleVisibility && onToggleVisibility(combatant.id)}
                      title={combatant.hidden || combatant.isSecret ? 'Reveal to players' : 'Hide from players'}
                      className={`p-1 rounded hover:bg-slate-800 transition cursor-pointer ${
                        combatant.hidden || combatant.isSecret ? 'text-purple-400' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {combatant.hidden || combatant.isSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>

                    {/* Move Up */}
                    <button
                      type="button"
                      disabled={originalIndex === 0}
                      onClick={() => onMoveCombatant && onMoveCombatant(originalIndex, originalIndex - 1)}
                      title="Move Up in Initiative"
                      className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>

                    {/* Move Down */}
                    <button
                      type="button"
                      disabled={originalIndex === combatants.length - 1}
                      onClick={() => onMoveCombatant && onMoveCombatant(originalIndex, originalIndex + 1)}
                      title="Move Down in Initiative"
                      className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 disabled:opacity-20 disabled:hover:bg-transparent"
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer Helper Note */}
      {isDm && (
        <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 italic flex items-center justify-between">
          <span>DM controls: use ▲▼ to resolve ties.</span>
          <span className="text-amber-400">Click tile to focus</span>
        </div>
      )}
    </div>
  );
};
