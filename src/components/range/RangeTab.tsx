/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  Ruler,
  Compass,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  Activity,
  Flame,
  Scale,
  RotateCcw,
} from 'lucide-react';

export const RangeTab: React.FC = () => {
  // 3D Range Finder States: Horizontal Distance, Vertical Distance, and Direction
  const [groundDistance, setGroundDistance] = useState<number>(30);
  const [height, setHeight] = useState<number>(30);
  const [isTargetBelow, setIsTargetBelow] = useState<boolean>(false);

  // Accordion active sections (Defaulted to Closed to guarantee 0-scroll viewport)
  const [isJumpOpen, setIsJumpOpen] = useState<boolean>(false);
  const [isFallOpen, setIsFallOpen] = useState<boolean>(false);
  const [isLiftOpen, setIsLiftOpen] = useState<boolean>(false);

  // Jump Calculator state
  const [strModifier, setStrModifier] = useState<number>(3);
  const [dexModifier, setDexModifier] = useState<number>(2);
  const [hasRunningStart, setHasRunningStart] = useState<boolean>(true);

  // Fall Damage Calculator state
  const [fallDistance, setFallDistance] = useState<number>(30);
  const [isIncapacitated, setIsIncapacitated] = useState<boolean>(false);

  // Lifting & Dragging state
  const [strScore, setStrScore] = useState<number>(10);
  const [sizeCategory, setSizeCategory] = useState<'medium' | 'large' | 'huge' | 'gargantuan'>('medium');

  // 3D Pythagorean calculation & grid rounding (>= .5 rounds up, < .5 rounds down)
  const rawHypotenuse = Math.sqrt(
    groundDistance * groundDistance + height * height
  );
  const hypotenuse = Math.round(rawHypotenuse / 5) * 5;
  const squares = Math.round(hypotenuse / 5);

  // Dynamic Reach Guidance based on standard 5e range brackets
  const reachGuidance = useMemo(() => {
    if (hypotenuse <= 5) return 'Reachable in Melee (5 ft)';
    if (hypotenuse <= 10) return 'Reachable with Reach (10 ft)';
    if (hypotenuse <= 30) return 'Reachable with 30 ft range (exceeds 10 ft)';
    if (hypotenuse <= 60) return 'Reachable with 60 ft range (exceeds 30 ft)';
    if (hypotenuse <= 120) return 'Reachable with 120 ft range (exceeds 60 ft)';
    if (hypotenuse <= 150) return 'Reachable with 150 ft range (exceeds 120 ft)';
    if (hypotenuse <= 300) return 'Reachable with 300 ft range (exceeds 150 ft)';
    if (hypotenuse <= 600) return 'Reachable with 600 ft range (exceeds 300 ft)';
    return 'Beyond 600 ft (exceeds standard weapon range)';
  }, [hypotenuse]);

  // Dynamic SVG Right Triangle Coordinates (Compact profile)
  const svgData = useMemo(() => {
    const width = 420;
    const canvasHeight = 150;
    const originX = 50;
    const maxDrawW = 310;
    const maxDrawH = 95;

    const maxLeg = Math.max(groundDistance, height, 10);
    const scale = Math.min(maxDrawW / maxLeg, maxDrawH / maxLeg);

    const legX = groundDistance > 0 ? Math.max(45, groundDistance * scale) : 25;
    const legY = height > 0 ? Math.max(26, height * scale) : 15;

    // Normal: Baseline at bottom (126), rises to (126 - legY)
    // Inverted: Baseline at top (24), drops to (24 + legY)
    const originY = isTargetBelow ? 24 : 126;
    const cornerX = originX + legX;
    const cornerY = originY;
    const targetX = cornerX;
    const targetY = isTargetBelow ? originY + legY : originY - legY;

    const midHypotenuseX = (originX + targetX) / 2;
    const midHypotenuseY = (originY + targetY) / 2;

    return {
      width,
      canvasHeight,
      originX,
      originY,
      cornerX,
      cornerY,
      targetX,
      targetY,
      midHypotenuseX,
      midHypotenuseY,
    };
  }, [groundDistance, height, isTargetBelow]);

  // Jump Calculations (5 ft / 10 ft + higher of STR or DEX mod)
  const bestJumpMod = Math.max(strModifier, dexModifier);
  const standingJumpDistance = Math.max(0, 5 + bestJumpMod);
  const runningJumpDistance = Math.max(0, 10 + bestJumpMod);
  const activeJumpDistance = hasRunningStart ? runningJumpDistance : standingJumpDistance;

  // Fall Damage Calculations (1 flat dmg per ft beyond 15 ft; 1 flat dmg from 0 ft for Incapacitated)
  const flatFallDamage = isIncapacitated
    ? Math.max(0, fallDistance) * 1
    : fallDistance <= 15
    ? 0
    : Math.max(0, fallDistance - 15);

  // Lifting & Dragging Calculations (Base = 15 × STR score; Double per size above Medium)
  const sizeMultiplier = sizeCategory === 'gargantuan' ? 8 : sizeCategory === 'huge' ? 4 : sizeCategory === 'large' ? 2 : 1;
  const liftCapacity = Math.max(0, 15 * strScore * sizeMultiplier);

  const handleResetInputs = () => {
    setGroundDistance(30);
    setHeight(30);
    setIsTargetBelow(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0b0f17] select-none p-2 gap-2">
      {/* 1. SINGLE INTERACTIVE 3D ELEVATION CANVAS & HERO READOUT */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 relative flex flex-col gap-2 shadow-md">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Ruler className="w-3.5 h-3.5 text-lime-400 shrink-0" />
            <span className="font-display font-bold text-xs text-slate-100 truncate">
              3D Range Calculator
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsTargetBelow((prev) => !prev)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition cursor-pointer flex items-center gap-1 ${
                isTargetBelow
                  ? 'bg-cyan-950 border-cyan-500/80 text-cyan-300'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
              }`}
              title="Toggle target vertical direction"
            >
              {isTargetBelow ? (
                <>
                  <ArrowDownRight className="w-3 h-3 text-cyan-400" />
                  <span>Target Below</span>
                </>
              ) : (
                <>
                  <ArrowUpRight className="w-3 h-3 text-amber-400" />
                  <span>Target Above</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleResetInputs}
              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition cursor-pointer"
              title="Reset inputs to 30ft"
              aria-label="Reset inputs to 30ft"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* High-Contrast Obsidian Hero Display (Vivid Lime Pop + Crisp White Guidance) */}
        <div className="p-2 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-md flex flex-col gap-1">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <span className="font-mono text-base sm:text-lg font-black text-lime-400 tracking-tight drop-shadow-[0_1px_4px_rgba(163,230,53,0.25)]">
              [ {hypotenuse} ft ({squares} squares) ]
            </span>
            <span className="font-mono text-[11px] font-semibold text-slate-400">
              · <span className="text-slate-300">{rawHypotenuse.toFixed(1)} ft exact</span>
            </span>
          </div>
          <div className="text-xs font-bold text-white flex items-center gap-1.5 pt-1 border-t border-slate-800">
            <span>🎯</span>
            <span>{reachGuidance}</span>
          </div>
        </div>

        {/* Scaled Right Triangle SVG Canvas */}
        <div className="relative w-full h-32 bg-slate-900/85 border border-slate-800/90 rounded-lg overflow-hidden flex items-center justify-center select-none shadow-inner">
          <svg
            viewBox={`0 0 ${svgData.width} ${svgData.canvasHeight}`}
            className="w-full h-full block"
          >
            <defs>
              <pattern id="elevation-grid-pattern" width="14" height="14" patternUnits="userSpaceOnUse">
                <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
              <linearGradient id="hypotenuseGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a3e635" />
                <stop offset="100%" stopColor="#84cc16" />
              </linearGradient>
            </defs>

            <rect width="100%" height="100%" fill="url(#elevation-grid-pattern)" rx="6" />

            <line
              x1="20"
              y1={svgData.originY}
              x2={svgData.width - 20}
              y2={svgData.originY}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {(groundDistance > 0 || height > 0) && (
              <polygon
                points={`${svgData.originX},${svgData.originY} ${svgData.cornerX},${svgData.cornerY} ${svgData.targetX},${svgData.targetY}`}
                fill="#a3e635"
                fillOpacity="0.08"
              />
            )}

            {groundDistance > 0 && height > 0 && (
              <path
                d={
                  isTargetBelow
                    ? `M ${svgData.cornerX - 7} ${svgData.cornerY} L ${svgData.cornerX - 7} ${svgData.cornerY + 7} L ${svgData.cornerX} ${svgData.cornerY + 7}`
                    : `M ${svgData.cornerX - 7} ${svgData.cornerY} L ${svgData.cornerX - 7} ${svgData.cornerY - 7} L ${svgData.cornerX} ${svgData.cornerY - 7}`
                }
                fill="none"
                stroke="#64748b"
                strokeWidth="1.2"
              />
            )}

            {/* Horizontal Leg (Amber) */}
            <line
              x1={svgData.originX}
              y1={svgData.originY}
              x2={svgData.cornerX}
              y2={svgData.cornerY}
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Vertical Leg (Cyan) */}
            <line
              x1={svgData.cornerX}
              y1={svgData.cornerY}
              x2={svgData.targetX}
              y2={svgData.targetY}
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Hypotenuse Diagonal Line (Lime) */}
            <line
              x1={svgData.originX}
              y1={svgData.originY}
              x2={svgData.targetX}
              y2={svgData.targetY}
              stroke="url(#hypotenuseGlowGrad)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            <circle cx={svgData.originX} cy={svgData.originY} r="4.5" fill="#f59e0b" />
            <circle cx={svgData.originX} cy={svgData.originY} r="7.5" fill="none" stroke="#f59e0b" strokeOpacity="0.3" strokeWidth="1.5" />

            <circle cx={svgData.targetX} cy={svgData.targetY} r="4.5" fill="#38bdf8" />
            <circle cx={svgData.targetX} cy={svgData.targetY} r="7.5" fill="none" stroke="#38bdf8" strokeOpacity="0.3" strokeWidth="1.5" />

            <text
              x={svgData.midHypotenuseX - 8}
              y={
                isTargetBelow
                  ? Math.min(138, svgData.midHypotenuseY + 13)
                  : Math.max(18, svgData.midHypotenuseY - 8)
              }
              textAnchor="middle"
              className="font-mono text-xs font-black fill-lime-400 select-none"
              style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.95))' }}
            >
              {hypotenuse} ft ({squares} squares)
            </text>

            <text
              x={(svgData.originX + svgData.cornerX) / 2}
              y={isTargetBelow ? svgData.originY - 6 : svgData.originY + 13}
              textAnchor="middle"
              className="font-mono text-[9px] font-bold fill-amber-400 select-none"
            >
              {groundDistance} ft
            </text>

            <text
              x={svgData.cornerX + 14}
              y={(svgData.cornerY + svgData.targetY) / 2 + 3}
              textAnchor="start"
              className="font-mono text-[9px] font-bold fill-cyan-400 select-none"
            >
              {height} ft
            </text>
          </svg>
        </div>

        {/* 2. DIRECT INTERACTIVE LEGS CONTROLS (HORIZONTAL & VERTICAL) */}
        <div className="grid grid-cols-2 gap-2">
          {/* Horizontal Leg (Amber 500) */}
          <div className="p-2 rounded-lg bg-slate-900/90 border border-amber-500/50 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label htmlFor="horizontal-leg-input" className="text-[10px] font-bold text-amber-300 font-mono tracking-wide flex items-center gap-1">
                <Compass className="w-3 h-3 text-amber-400" />
                <span>HORIZONTAL</span>
              </label>
              <span className="text-[9px] font-mono text-amber-400 font-bold">
                {groundDistance}ft
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setGroundDistance((prev) => Math.max(0, prev - 5))}
                className="h-6.5 w-6.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="-5 ft horizontal"
                aria-label="-5 ft horizontal"
              >
                <Minus className="w-3 h-3" />
              </button>

              <input
                id="horizontal-leg-input"
                type="number"
                min="0"
                step="5"
                value={groundDistance}
                onChange={(e) => setGroundDistance(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="flex-1 min-w-0 h-6.5 px-1.5 text-center text-xs font-mono font-bold rounded bg-slate-950 border border-amber-500/50 text-amber-300 focus:outline-none focus:border-amber-400 tabular-nums"
              />

              <button
                type="button"
                onClick={() => setGroundDistance((prev) => prev + 5)}
                className="h-6.5 w-6.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="+5 ft horizontal"
                aria-label="+5 ft horizontal"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {[15, 30, 60, 120].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGroundDistance(val)}
                  className={`py-0.5 text-[9px] font-mono rounded border transition cursor-pointer ${
                    groundDistance === val
                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {val}ft
                </button>
              ))}
            </div>
          </div>

          {/* Vertical Leg (Cyan 400) */}
          <div className="p-2 rounded-lg bg-slate-900/90 border border-cyan-500/50 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label htmlFor="vertical-leg-input" className="text-[10px] font-bold text-cyan-300 font-mono tracking-wide flex items-center gap-1">
                {isTargetBelow ? (
                  <ArrowDownRight className="w-3 h-3 text-cyan-400" />
                ) : (
                  <ArrowUpRight className="w-3 h-3 text-cyan-400" />
                )}
                <span>VERTICAL</span>
              </label>
              <span className="text-[9px] font-mono text-cyan-400 font-bold">
                {isTargetBelow ? `-${height}ft` : `+${height}ft`}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setHeight((prev) => Math.max(0, prev - 5))}
                className="h-6.5 w-6.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="-5 ft vertical"
                aria-label="-5 ft vertical"
              >
                <Minus className="w-3 h-3" />
              </button>

              <input
                id="vertical-leg-input"
                type="number"
                min="0"
                step="5"
                value={height}
                onChange={(e) => setHeight(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="flex-1 min-w-0 h-6.5 px-1.5 text-center text-xs font-mono font-bold rounded bg-slate-950 border border-cyan-500/50 text-cyan-300 focus:outline-none focus:border-cyan-400 tabular-nums"
              />

              <button
                type="button"
                onClick={() => setHeight((prev) => prev + 5)}
                className="h-6.5 w-6.5 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="+5 ft vertical"
                aria-label="+5 ft vertical"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-1">
              {[10, 30, 60, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setHeight(val)}
                  className={`py-0.5 text-[9px] font-mono rounded border transition cursor-pointer ${
                    height === val
                      ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-300 shadow-sm'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {val}ft
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 3. COLLAPSIBLE JUMP CALCULATOR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm shrink-0">
        <button
          type="button"
          onClick={() => setIsJumpOpen(!isJumpOpen)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer bg-slate-900/95"
        >
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-display">Jump Calculator</span>
            <span className="text-[10px] font-mono text-emerald-400 font-semibold">
              · {activeJumpDistance} ft ({hasRunningStart ? 'Running' : 'Standing'})
            </span>
          </div>
          {isJumpOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {isJumpOpen && (
          <div className="p-3 border-t border-slate-800/80 space-y-2.5 text-xs animate-fadeIn">
            <div className="grid grid-cols-2 gap-2.5 items-center">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-slate-300">
                    STR Modifier
                  </label>
                  <span className="text-[10px] font-mono text-amber-300 font-bold">
                    {strModifier >= 0 ? `+${strModifier}` : strModifier}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStrModifier((prev) => prev - 1)}
                    className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    value={strModifier}
                    onChange={(e) => setStrModifier(parseInt(e.target.value, 10) || 0)}
                    className="flex-1 min-w-0 h-7 text-center font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setStrModifier((prev) => prev + 1)}
                    className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-slate-300">
                    DEX Modifier
                  </label>
                  <span className="text-[10px] font-mono text-cyan-300 font-bold">
                    {dexModifier >= 0 ? `+${dexModifier}` : dexModifier}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setDexModifier((prev) => prev - 1)}
                    className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    value={dexModifier}
                    onChange={(e) => setDexModifier(parseInt(e.target.value, 10) || 0)}
                    className="flex-1 min-w-0 h-7 text-center font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => setDexModifier((prev) => prev + 1)}
                    className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                <input
                  type="checkbox"
                  checked={hasRunningStart}
                  onChange={(e) => setHasRunningStart(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-amber-400 focus:ring-amber-400 cursor-pointer"
                />
                <div className="text-[11px] leading-tight">
                  <span className="font-semibold text-slate-200 block">Running Start (10-ft lead)</span>
                  <span className="text-[10px] text-slate-400">Uses 10 ft base instead of 5 ft base</span>
                </div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
              <div
                className={`p-2 rounded-lg border transition ${
                  !hasRunningStart
                    ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'bg-slate-950 border-slate-800 opacity-75'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Standing Jump
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-mono font-bold text-amber-300">
                    {standingJumpDistance} ft
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {bestJumpMod >= 0 ? `(5 + ${bestJumpMod})` : `(5 - ${Math.abs(bestJumpMod)})`}
                  </span>
                </div>
              </div>

              <div
                className={`p-2 rounded-lg border transition ${
                  hasRunningStart
                    ? 'bg-amber-950/40 border-amber-500/60 ring-1 ring-amber-500/30'
                    : 'bg-slate-950 border-slate-800 opacity-75'
                }`}
              >
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Running Jump
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-base font-mono font-bold text-cyan-300">
                    {runningJumpDistance} ft
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {bestJumpMod >= 0 ? `(10 + ${bestJumpMod})` : `(10 - ${Math.abs(bestJumpMod)})`}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/70">
              No check required; limited by total movement speed.
            </div>
          </div>
        )}
      </div>

      {/* 4. COLLAPSIBLE FALL DAMAGE CALCULATOR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm shrink-0">
        <button
          type="button"
          onClick={() => setIsFallOpen(!isFallOpen)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer bg-slate-900/95"
        >
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-display">Fall Damage Calculator</span>
            <span className="text-[10px] font-mono text-rose-400 font-semibold">
              · Flat {flatFallDamage} HP
            </span>
          </div>
          {isFallOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {isFallOpen && (
          <div className="p-3 border-t border-slate-800/80 space-y-2.5 text-xs animate-fadeIn">
            <div className="grid grid-cols-2 gap-2.5 items-center">
              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                  Fall Distance (ft)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setFallDistance((prev) => Math.max(0, prev - 5))}
                    className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min="0"
                    step="5"
                    value={fallDistance}
                    onChange={(e) => setFallDistance(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="flex-1 min-w-0 h-7 text-center font-mono font-bold rounded bg-slate-950 border border-slate-700 text-rose-300"
                  />
                  <button
                    type="button"
                    onClick={() => setFallDistance((prev) => prev + 5)}
                    className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div className="flex flex-col justify-end pt-1">
                <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                  <input
                    type="checkbox"
                    checked={isIncapacitated}
                    onChange={(e) => setIsIncapacitated(e.target.checked)}
                    className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500 cursor-pointer"
                  />
                  <div className="text-[11px] leading-tight">
                    <span className="font-semibold text-rose-300 block">Incapacitated</span>
                    <span className="text-[9px] text-slate-400">1 flat dmg/ft from 0 ft</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {[10, 15, 20, 30, 45, 60].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setFallDistance(d)}
                  className={`flex-1 py-0.5 text-[9px] font-mono rounded border transition cursor-pointer ${
                    fallDistance === d
                      ? 'bg-rose-950 border-rose-500 text-rose-200 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {d}ft
                </button>
              ))}
            </div>

            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-600/50 space-y-1.5">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-400/90 block">
                  Fall Damage
                </span>
                <div className="text-base font-mono font-bold text-rose-200">
                  Flat Impact: <span className="text-lg text-rose-400">{flatFallDamage} HP</span>
                </div>
              </div>

              <div className="text-[10px] text-rose-300/80 border-t border-rose-800/40 pt-1">
                {isIncapacitated
                  ? 'Incapacitated: takes 1 flat damage per foot fallen from 0 ft.'
                  : fallDistance <= 15
                  ? 'Normal fall: ≤ 15 ft causes 0 damage (acrobatic recovery threshold).'
                  : `Normal fall: 0 damage for first 15 ft, then 1 flat damage per foot (${fallDistance} - 15 = ${flatFallDamage} HP).`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 5. COLLAPSIBLE LIFTING & DRAGGING CALCULATOR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm shrink-0">
        <button
          type="button"
          onClick={() => setIsLiftOpen(!isLiftOpen)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer bg-slate-900/95"
        >
          <div className="flex items-center gap-1.5">
            <Scale className="w-3.5 h-3.5 text-indigo-400" />
            <span className="font-display">Lifting & Dragging</span>
            <span className="text-[10px] font-mono text-indigo-400 font-semibold">
              · {liftCapacity} lbs ({sizeCategory.toUpperCase()})
            </span>
          </div>
          {isLiftOpen ? (
            <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          )}
        </button>

        {isLiftOpen && (
          <div className="p-3 border-t border-slate-800/80 space-y-2.5 text-xs animate-fadeIn">
            <div className="grid grid-cols-2 gap-2.5 items-center">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] font-semibold text-slate-300">
                    Strength Score (STR)
                  </label>
                  <span className="text-[10px] font-mono text-indigo-300 font-bold">
                    STR {strScore}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStrScore((prev) => Math.max(1, prev - 1))}
                    className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="30"
                    value={strScore}
                    onChange={(e) => setStrScore(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="flex-1 min-w-0 h-7 text-center font-mono font-bold rounded bg-slate-950 border border-slate-700 text-indigo-300"
                  />
                  <button
                    type="button"
                    onClick={() => setStrScore((prev) => Math.min(30, prev + 1))}
                    className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-semibold text-slate-300 block mb-1">
                  Size Category
                </span>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setSizeCategory('medium')}
                    className={`py-1 text-[9px] font-mono rounded border transition cursor-pointer ${
                      sizeCategory === 'medium'
                        ? 'bg-indigo-950 border-indigo-500 text-indigo-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Med / Sm
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeCategory('large')}
                    className={`py-1 text-[9px] font-mono rounded border transition cursor-pointer ${
                      sizeCategory === 'large'
                        ? 'bg-indigo-950 border-indigo-500 text-indigo-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Large (×2)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeCategory('huge')}
                    className={`py-1 text-[9px] font-mono rounded border transition cursor-pointer ${
                      sizeCategory === 'huge'
                        ? 'bg-indigo-950 border-indigo-500 text-indigo-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Huge (×4)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSizeCategory('gargantuan')}
                    className={`py-1 text-[9px] font-mono rounded border transition cursor-pointer ${
                      sizeCategory === 'gargantuan'
                        ? 'bg-indigo-950 border-indigo-500 text-indigo-200 font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Garg (×8)
                  </button>
                </div>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-600/50 space-y-1">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-400/90 block">
                  Push / Drag / Lift Capacity
                </span>
                <div className="text-base font-mono font-bold text-indigo-200">
                  Maximum: <span className="text-lg text-indigo-300">{liftCapacity.toLocaleString()} lbs</span>
                </div>
              </div>

              <div className="text-[10px] text-indigo-300/80 border-t border-indigo-800/40 pt-1">
                Base capacity = 15 × STR score ({15 * strScore} lbs).
                {sizeMultiplier > 1 && ` Multiplied by ×${sizeMultiplier} for ${sizeCategory.toUpperCase()} size.`}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RangeTab;
