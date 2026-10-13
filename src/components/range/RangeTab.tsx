import React, { useState, useMemo } from 'react';
import {
  Ruler,
  Compass,
  ArrowUpRight,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  Activity,
  Flame,
  Layers,
  RotateCcw,
} from 'lucide-react';
import { liveFeedSync } from '../../utils/liveFeedSync';

export type RangeRuleMode = 'raw' | 'chebyshev';

export const RangeTab: React.FC = () => {
  // 3D Range Finder Numeric States (Ground & Altitude)
  const [groundDistance, setGroundDistance] = useState<number>(40);
  const [altitudeDiff, setAltitudeDiff] = useState<number>(60);
  const [ruleMode, setRuleMode] = useState<RangeRuleMode>('raw');

  // Accordion active sections (Jump Calculator is open by default)
  const [isJumpOpen, setIsJumpOpen] = useState<boolean>(true);
  const [isFallOpen, setIsFallOpen] = useState<boolean>(false);

  // Ashtapor Homebrew Jump Calculator state
  const [strModifier, setStrModifier] = useState<number>(3);
  const [dexModifier, setDexModifier] = useState<number>(2);
  const [hasRunningStart, setHasRunningStart] = useState<boolean>(true);

  // Ashtapor Homebrew Fall Damage Calculator state
  const [fallDistance, setFallDistance] = useState<number>(30);
  const [isIncapacitated, setIsIncapacitated] = useState<boolean>(false);

  // 1. Calculations
  const euclideanDistance = Math.sqrt(
    groundDistance * groundDistance + altitudeDiff * altitudeDiff
  );

  const tacticalRange =
    ruleMode === 'chebyshev'
      ? Math.max(groundDistance, altitudeDiff)
      : Math.ceil(euclideanDistance / 5) * 5;

  const gridSquares = Math.round(tacticalRange / 5);

  const formattedTrueDistance = Number.isInteger(euclideanDistance)
    ? euclideanDistance.toString()
    : euclideanDistance.toFixed(1);

  const pitchAngleDegrees =
    groundDistance === 0
      ? altitudeDiff > 0
        ? 90
        : 0
      : Math.round(Math.atan2(altitudeDiff, groundDistance) * (180 / Math.PI));

  // Dynamic SVG Proportional Triangle Coordinates Calculation
  const svgData = useMemo(() => {
    const width = 420;
    const height = 180;
    const originX = 45;
    const originY = 150;
    const maxDrawW = 260;
    const maxDrawH = 115;

    const maxLeg = Math.max(groundDistance, altitudeDiff, 10);
    const scale = Math.min(maxDrawW / maxLeg, maxDrawH / maxLeg);

    const legX = groundDistance > 0 ? Math.max(40, groundDistance * scale) : 20;
    const legY = altitudeDiff > 0 ? Math.max(25, altitudeDiff * scale) : 10;

    const cornerX = originX + legX;
    const cornerY = originY;
    const targetX = cornerX;
    const targetY = originY - legY;

    const midHypotenuseX = (originX + targetX) / 2;
    const midHypotenuseY = (originY + targetY) / 2;

    return {
      width,
      height,
      originX,
      originY,
      cornerX,
      cornerY,
      targetX,
      targetY,
      midHypotenuseX,
      midHypotenuseY,
    };
  }, [groundDistance, altitudeDiff]);

  // Jump Calculations:
  // Math.max(STR mod, DEX mod)
  // Standing: 5 + bestMod
  // Running: 10 + bestMod
  const bestJumpMod = Math.max(strModifier, dexModifier);
  const standingJumpDistance = Math.max(0, 5 + bestJumpMod);
  const runningJumpDistance = Math.max(0, 10 + bestJumpMod);
  const activeJumpDistance = hasRunningStart ? runningJumpDistance : standingJumpDistance;

  // Fall Damage Calculations:
  // If <= 15 ft -> 0 dmg. If > 15 ft -> distance - 15 HP flat.
  // Incapacitated -> 1 flat dmg/ft from 0.
  const flatFallDamage = isIncapacitated
    ? Math.max(0, fallDistance) * 1
    : fallDistance <= 15
    ? 0
    : Math.max(0, fallDistance - 15);

  const handleLogFallDamage = () => {
    const msg = `💥 Flat Fall Damage (${fallDistance} ft${isIncapacitated ? ', Incapacitated' : ' Normal'}): ${flatFallDamage} HP flat damage.`;
    liveFeedSync.recordCombatLog(msg, true);
  };

  const handleResetInputs = () => {
    setGroundDistance(30);
    setAltitudeDiff(30);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0b0f17] select-none p-2.5 gap-2.5">
      {/* 1. UNIFIED INTERACTIVE 3D ELEVATION DIAGRAM */}
      <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-3 relative flex flex-col gap-3 shadow-md">
        {/* Header Strip with Title, Quick Reset & Rule Mode Pill */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Ruler className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-display font-bold text-xs text-slate-100 truncate">
              3D Elevation Calculator
            </span>
            <span className="text-[10px] font-mono text-emerald-400/90 font-semibold">
              · {pitchAngleDegrees}° Pitch
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Rule Mode Pill Toggle: 5e RAW Standard vs Chebyshev Grid */}
            <button
              type="button"
              onClick={() => setRuleMode((prev) => (prev === 'raw' ? 'chebyshev' : 'raw'))}
              className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-full border transition cursor-pointer flex items-center gap-1 ${
                ruleMode === 'raw'
                  ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-cyan-950/90 border-cyan-500/70 text-cyan-300 ring-1 ring-cyan-500/30'
              }`}
              title="Click to toggle between 5e RAW Standard (Euclidean rounded to 5ft) and Chebyshev (5-5-5 diagonal rule)"
            >
              <Layers className="w-2.5 h-2.5" />
              <span>{ruleMode === 'raw' ? '5e RAW Standard' : 'Chebyshev 5-5-5'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetInputs}
              className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-slate-900 transition cursor-pointer"
              title="Reset Ground and Altitude to 30ft"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Interactive Geometric SVG Canvas & Center Badge */}
        <div className="relative w-full h-44 bg-slate-900/80 border border-slate-800/90 rounded-lg overflow-hidden flex items-center justify-center select-none shadow-inner">
          <svg
            viewBox={`0 0 ${svgData.width} ${svgData.height}`}
            className="w-full h-full block"
          >
            <defs>
              <pattern id="elevation-grid" width="14" height="14" patternUnits="userSpaceOnUse">
                <path d="M 14 0 L 0 0 0 14" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
              <linearGradient id="hypotenuseGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#06b6d4" />
              </linearGradient>
            </defs>

            {/* Grid Pattern Background */}
            <rect width="100%" height="100%" fill="url(#elevation-grid)" rx="6" />

            {/* Baseline Reference Dash */}
            <line
              x1="20"
              y1={svgData.originY}
              x2={svgData.width - 20}
              y2={svgData.originY}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {/* Shaded Triangle Fill */}
            {(groundDistance > 0 || altitudeDiff > 0) && (
              <polygon
                points={`${svgData.originX},${svgData.originY} ${svgData.cornerX},${svgData.cornerY} ${svgData.targetX},${svgData.targetY}`}
                fill="#10b981"
                fillOpacity="0.08"
              />
            )}

            {/* Right Angle Indicator */}
            {groundDistance > 0 && altitudeDiff > 0 && (
              <path
                d={`M ${svgData.cornerX - 8} ${svgData.cornerY} L ${svgData.cornerX - 8} ${svgData.cornerY - 8} L ${svgData.cornerX} ${svgData.cornerY - 8}`}
                fill="none"
                stroke="#64748b"
                strokeWidth="1"
              />
            )}

            {/* Horizontal Leg (Ground Distance Line) */}
            <line
              x1={svgData.originX}
              y1={svgData.originY}
              x2={svgData.cornerX}
              y2={svgData.cornerY}
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Vertical Leg (Altitude Line) */}
            <line
              x1={svgData.cornerX}
              y1={svgData.cornerY}
              x2={svgData.targetX}
              y2={svgData.targetY}
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Hypotenuse Vector */}
            <line
              x1={svgData.originX}
              y1={svgData.originY}
              x2={svgData.targetX}
              y2={svgData.targetY}
              stroke="url(#hypotenuseGlow)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Character Origin Marker */}
            <circle cx={svgData.originX} cy={svgData.originY} r="4" fill="#f59e0b" />
            <circle cx={svgData.originX} cy={svgData.originY} r="7" fill="none" stroke="#f59e0b" strokeOpacity="0.3" strokeWidth="1.5" />

            {/* Target Airborne Marker */}
            <circle cx={svgData.targetX} cy={svgData.targetY} r="4" fill="#38bdf8" />
            <circle cx={svgData.targetX} cy={svgData.targetY} r="7" fill="none" stroke="#38bdf8" strokeOpacity="0.3" strokeWidth="1.5" />
          </svg>

          {/* GLOWING TACTICAL BADGE (Directly along the Hypotenuse Vector) */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-slate-950/95 border border-emerald-500/80 rounded-xl px-3 py-1.5 shadow-xl shadow-emerald-500/10 ring-1 ring-emerald-400/40 backdrop-blur-md text-center pointer-events-auto">
            <div className="flex items-center justify-center gap-1.5 leading-none">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">
                Direct LoS:
              </span>
              <span className="text-sm font-mono font-extrabold text-emerald-300 tabular-nums">
                {tacticalRange} ft
              </span>
              <span className="text-[11px] font-mono font-bold text-cyan-300">
                ({gridSquares} sq)
              </span>
            </div>
            <div className="text-[9px] font-mono text-slate-400 mt-0.5">
              Euclidean: <strong className="text-amber-300">{formattedTrueDistance} ft</strong> · Pitch: {pitchAngleDegrees}°
            </div>
          </div>
        </div>

        {/* INTERACTIVE LEGS CONTROLS (Positioned directly for Ground and Altitude) */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Horizontal Leg (Ground Distance) Controller */}
          <div className="p-2 rounded-lg bg-slate-900/90 border border-amber-500/40 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label htmlFor="ground-leg-input" className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                <span>Ground Distance</span>
              </label>
              <span className="text-[9px] font-mono text-amber-400/80 uppercase">Horizontal</span>
            </div>

            {/* Stepper Input: [ - ] <input> [ + ] */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setGroundDistance((prev) => Math.max(0, prev - 5))}
                className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="-5 ft ground distance"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <input
                id="ground-leg-input"
                type="number"
                min="0"
                step="5"
                value={groundDistance}
                onChange={(e) => setGroundDistance(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="flex-1 min-w-0 h-7 px-1.5 text-center text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 tabular-nums"
              />

              <button
                type="button"
                onClick={() => setGroundDistance((prev) => prev + 5)}
                className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="+5 ft ground distance"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compact Preset Chips: [ 15ft ] [ 30ft ] [ 60ft ] [ 120ft ] */}
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {[15, 30, 60, 120].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setGroundDistance(val)}
                  className={`py-1 text-[9px] font-mono rounded border transition cursor-pointer ${
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

          {/* Vertical Leg (Altitude / Height) Controller */}
          <div className="p-2 rounded-lg bg-slate-900/90 border border-cyan-500/40 space-y-1.5 shadow-sm">
            <div className="flex items-center justify-between">
              <label htmlFor="altitude-leg-input" className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                <ArrowUpRight className="w-3.5 h-3.5 text-cyan-400" />
                <span>Altitude / Height</span>
              </label>
              <span className="text-[9px] font-mono text-cyan-400/80 uppercase">Vertical</span>
            </div>

            {/* Stepper Input: [ - ] <input> [ + ] */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAltitudeDiff((prev) => Math.max(0, prev - 5))}
                className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="-5 ft altitude"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>

              <input
                id="altitude-leg-input"
                type="number"
                min="0"
                step="5"
                value={altitudeDiff}
                onChange={(e) => setAltitudeDiff(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="flex-1 min-w-0 h-7 px-1.5 text-center text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-cyan-300 focus:outline-none focus:border-cyan-400 tabular-nums"
              />

              <button
                type="button"
                onClick={() => setAltitudeDiff((prev) => prev + 5)}
                className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 flex items-center justify-center transition cursor-pointer"
                title="+5 ft altitude"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compact Altitude Chips: [ 10ft ] [ 30ft ] [ 60ft ] [ 100ft ] */}
            <div className="grid grid-cols-4 gap-1 pt-0.5">
              {[10, 30, 60, 100].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAltitudeDiff(val)}
                  className={`py-1 text-[9px] font-mono rounded border transition cursor-pointer ${
                    altitudeDiff === val
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

      {/* 2. COLLAPSIBLE ASHTAPOR JUMP CALCULATOR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm shrink-0">
        <button
          type="button"
          onClick={() => setIsJumpOpen(!isJumpOpen)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer bg-slate-900/95"
        >
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span className="font-display">Ashtapor Jump Calculator</span>
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
              {/* STR Modifier */}
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

              {/* DEX Modifier */}
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

            {/* Running Start Checkbox */}
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

            {/* Jump Outputs */}
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
                    (5 + {bestJumpMod >= 0 ? `+${bestJumpMod}` : bestJumpMod})
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
                    (10 + {bestJumpMod >= 0 ? `+${bestJumpMod}` : bestJumpMod})
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

      {/* 3. COLLAPSIBLE ASHTAPOR FALL DAMAGE CALCULATOR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm shrink-0">
        <button
          type="button"
          onClick={() => setIsFallOpen(!isFallOpen)}
          className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer bg-slate-900/95"
        >
          <div className="flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            <span className="font-display">Ashtapor Fall Damage Calculator</span>
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

            <div className="p-2.5 rounded-lg bg-rose-950/30 border border-rose-600/50 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-400/90 block">
                    Ashtapor Fall Damage
                  </span>
                  <div className="text-base font-mono font-bold text-rose-200">
                    Flat Impact: <span className="text-lg text-rose-400">{flatFallDamage} HP</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleLogFallDamage}
                  className="px-2.5 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-md transition cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Log Feed</span>
                </button>
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
    </div>
  );
};

export default RangeTab;
