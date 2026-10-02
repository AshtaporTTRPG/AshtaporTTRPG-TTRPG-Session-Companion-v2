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
  Dices,
  ShieldAlert,
  Flame,
} from 'lucide-react';
import { executeDiceRoll } from '../utils/dice';
import { liveFeedSync } from '../utils/liveFeedSync';

export const GeometryCalculator: React.FC = () => {
  // 3D Range Finder: Ground Distance & Target Altitude numeric states
  const [groundDistance, setGroundDistance] = useState<number>(40);
  const [altitudeDiff, setAltitudeDiff] = useState<number>(60);

  // Accordion active sections
  const [activeAccordion, setActiveAccordion] = useState<'none' | 'jump' | 'fall'>('jump');

  // Ashtapor Homebrew Jump Calculator state
  const [strModifier, setStrModifier] = useState<number>(3);
  const [dexModifier, setDexModifier] = useState<number>(2);
  const [hasRunningStart, setHasRunningStart] = useState<boolean>(true);

  // Ashtapor Homebrew Fall Damage Calculator state
  const [fallDistance, setFallDistance] = useState<number>(30);
  const [isIncapacitated, setIsIncapacitated] = useState<boolean>(false);

  // 1. 3D Range Calculations
  const trueDistance = Math.sqrt(
    groundDistance * groundDistance + altitudeDiff * altitudeDiff
  );
  const tactical5eRange = Math.ceil(trueDistance / 5) * 5;
  const gridSquares = tactical5eRange / 5;
  const formattedTrueDistance = Number.isInteger(trueDistance)
    ? trueDistance.toString()
    : trueDistance.toFixed(1);

  const pitchAngleDegrees =
    groundDistance === 0
      ? altitudeDiff > 0
        ? 90
        : 0
      : Math.round(Math.atan2(altitudeDiff, groundDistance) * (180 / Math.PI));

  // Dynamic SVG Proportional Triangle Coordinates Calculation
  const svgData = useMemo(() => {
    const svgWidth = 440;
    const svgHeight = 150;
    const originX = 50;
    const originY = 125;
    const maxDrawWidth = 280;
    const maxDrawHeight = 90;

    const maxLeg = Math.max(groundDistance, altitudeDiff, 10);
    const scale = Math.min(maxDrawWidth / maxLeg, maxDrawHeight / maxLeg);

    const legX = groundDistance > 0 ? Math.max(30, groundDistance * scale) : 0;
    const legY = altitudeDiff > 0 ? Math.max(20, altitudeDiff * scale) : 0;

    const cornerX = originX + legX;
    const cornerY = originY;
    const targetX = cornerX;
    const targetY = originY - legY;

    const midHypotenuseX = (originX + targetX) / 2;
    const midHypotenuseY = (originY + targetY) / 2;
    const midGroundX = (originX + cornerX) / 2;
    const midAltitudeY = (cornerY + targetY) / 2;

    return {
      svgWidth,
      svgHeight,
      originX,
      originY,
      cornerX,
      cornerY,
      targetX,
      targetY,
      midHypotenuseX,
      midHypotenuseY,
      midGroundX,
      midAltitudeY,
    };
  }, [groundDistance, altitudeDiff]);

  // 2. Ashtapor Homebrew Jump Calculations
  // Logic: Jump distance uses Math.max(STR mod, DEX mod).
  // Standing Jump: Math.max(0, 5 + Math.max(strMod, dexMod)) ft.
  // Running Jump: Math.max(0, 10 + Math.max(strMod, dexMod)) ft.
  const bestJumpMod = Math.max(strModifier, dexModifier);
  const standingJumpDistance = Math.max(0, 5 + bestJumpMod);
  const runningJumpDistance = Math.max(0, 10 + bestJumpMod);
  const activeJumpDistance = hasRunningStart ? runningJumpDistance : standingJumpDistance;

  // 3. Ashtapor Homebrew Fall Damage Calculation
  // Normal fall: If distance <= 15 ft -> 0 damage. If distance > 15 ft -> (distance - 15) flat damage.
  // Incapacitated fall: 1 flat damage per foot from 0 ft (distance * 1).
  const flatFallDamage = isIncapacitated
    ? Math.max(0, fallDistance) * 1
    : fallDistance <= 15
    ? 0
    : Math.max(0, fallDistance - 15);

  // 1-click button to log the fall damage to the live feed
  const handleLogFallDamage = () => {
    const msg = `💥 Flat Fall Damage (${fallDistance} ft${isIncapacitated ? ', Incapacitated' : ' Normal'}): ${flatFallDamage} HP flat damage.`;
    liveFeedSync.recordCombatLog(msg, true);
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-y-auto bg-[#0b0f17] select-none p-2.5 gap-2">
      {/* 1. TOP 2-COLUMN INPUT GRID: Ground Distance & Target Altitude */}
      <div className="grid grid-cols-2 gap-2 shrink-0">
        {/* Ground Distance Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="ground-input" className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <Compass className="w-3 h-3 text-amber-400" />
              <span>Ground (ft)</span>
            </label>
            <span className="text-[10px] font-mono text-amber-400/80">Horizontal</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setGroundDistance((prev) => Math.max(0, prev - 5))}
              className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="-5 ft"
            >
              <Minus className="w-3 h-3" />
            </button>

            <input
              id="ground-input"
              type="number"
              min="0"
              step="5"
              value={groundDistance}
              onChange={(e) => setGroundDistance(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="flex-1 min-w-0 h-7 px-1.5 text-center text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
            />

            <button
              type="button"
              onClick={() => setGroundDistance((prev) => prev + 5)}
              className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="+5 ft"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 pt-0.5">
            {[15, 30, 60, 120].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setGroundDistance(val)}
                className={`flex-1 py-0.5 text-[9px] font-mono rounded border transition cursor-pointer ${
                  groundDistance === val
                    ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {val}ft
              </button>
            ))}
          </div>
        </div>

        {/* Target Altitude Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2 shadow-sm space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="altitude-input" className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-cyan-400" />
              <span>Altitude (ft)</span>
            </label>
            <span className="text-[10px] font-mono text-cyan-400/80">Vertical</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setAltitudeDiff((prev) => Math.max(0, prev - 5))}
              className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="-5 ft"
            >
              <Minus className="w-3 h-3" />
            </button>

            <input
              id="altitude-input"
              type="number"
              min="0"
              step="5"
              value={altitudeDiff}
              onChange={(e) => setAltitudeDiff(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="flex-1 min-w-0 h-7 px-1.5 text-center text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-cyan-300 focus:outline-none focus:border-cyan-400"
            />

            <button
              type="button"
              onClick={() => setAltitudeDiff((prev) => prev + 5)}
              className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="+5 ft"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 pt-0.5">
            {[10, 30, 60, 100].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAltitudeDiff(val)}
                className={`flex-1 py-0.5 text-[9px] font-mono rounded border transition cursor-pointer ${
                  altitudeDiff === val
                    ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-300'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {val}ft
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. PROMINENT TACTICAL OUTPUT CARD */}
      <div className="p-2 rounded-xl bg-slate-900 border border-emerald-500/50 shadow flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-emerald-950 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shrink-0">
            <Ruler className="w-3.5 h-3.5" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tactical 5e Range:
              </span>
              <span className="text-sm font-mono font-bold text-emerald-300 tabular-nums">
                {tactical5eRange} ft
              </span>
              <span className="text-[10px] font-mono text-emerald-400/80">
                ({gridSquares} sq)
              </span>
            </div>
            <div className="text-[10px] font-mono text-slate-400">
              Euclidean: <strong className="text-amber-300">{formattedTrueDistance} ft</strong> · Pitch: {pitchAngleDegrees}°
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 block">
            5e RAW Standard
          </span>
        </div>
      </div>

      {/* 3. RESPONSIVE SVG RIGHT-TRIANGLE DIAGRAM */}
      <div className="h-36 shrink-0 bg-slate-900/90 border border-slate-800 rounded-xl p-1.5 overflow-hidden flex flex-col shadow-sm">
        <div className="flex items-center justify-between pb-0.5 border-b border-slate-800/80 shrink-0">
          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider">
            3D Elevation Diagram
          </span>
          <span className="text-[9px] font-mono text-emerald-400 font-bold">
            Hypotenuse: {tactical5eRange} ft
          </span>
        </div>

        <div className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgData.svgWidth} ${svgData.svgHeight}`}
            className="w-full h-full block"
          >
            <defs>
              <pattern id="compact-geo-grid" width="16" height="16" patternUnits="userSpaceOnUse">
                <path d="M 16 0 L 0 0 0 16" fill="none" stroke="#1e293b" strokeWidth="0.5" />
              </pattern>
            </defs>

            <rect width="100%" height="100%" fill="url(#compact-geo-grid)" rx="6" />

            <line
              x1="20"
              y1={svgData.originY}
              x2={svgData.svgWidth - 20}
              y2={svgData.originY}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {(groundDistance > 0 || altitudeDiff > 0) && (
              <polygon
                points={`${svgData.originX},${svgData.originY} ${svgData.cornerX},${svgData.cornerY} ${svgData.targetX},${svgData.targetY}`}
                fill="#10b981"
                fillOpacity="0.1"
              />
            )}

            {groundDistance > 0 && altitudeDiff > 0 && (
              <path
                d={`M ${svgData.cornerX - 8} ${svgData.cornerY} L ${svgData.cornerX - 8} ${svgData.cornerY - 8} L ${svgData.cornerX} ${svgData.cornerY - 8}`}
                fill="none"
                stroke="#475569"
                strokeWidth="1"
              />
            )}

            {/* Base Line */}
            <line
              x1={svgData.originX}
              y1={svgData.originY}
              x2={svgData.cornerX}
              y2={svgData.cornerY}
              stroke="#f59e0b"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Height Line */}
            <line
              x1={svgData.cornerX}
              y1={svgData.cornerY}
              x2={svgData.targetX}
              y2={svgData.targetY}
              stroke="#38bdf8"
              strokeWidth="2"
              strokeLinecap="round"
            />

            {/* Hypotenuse */}
            <line
              x1={svgData.originX}
              y1={svgData.originY}
              x2={svgData.targetX}
              y2={svgData.targetY}
              stroke="#10b981"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Base Label */}
            <g transform={`translate(${svgData.midGroundX}, ${svgData.originY + 12})`}>
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fbbf24"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {groundDistance} ft
              </text>
            </g>

            {/* Altitude Label */}
            <g transform={`translate(${svgData.targetX + 6}, ${svgData.midAltitudeY})`}>
              <text
                x="0"
                y="0"
                textAnchor="start"
                dominantBaseline="middle"
                fill="#38bdf8"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {altitudeDiff} ft
              </text>
            </g>

            {/* Hypotenuse Tactical Label */}
            <g transform={`translate(${svgData.midHypotenuseX - 10}, ${svgData.midHypotenuseY - 10})`}>
              <rect
                x="-36"
                y="-8"
                width="72"
                height="16"
                rx="3"
                fill="#022c22"
                stroke="#10b981"
                strokeWidth="1"
              />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#34d399"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                {tactical5eRange} ft
              </text>
            </g>

            <circle cx={svgData.originX} cy={svgData.originY} r="3.5" fill="#10b981" />
            <circle cx={svgData.targetX} cy={svgData.targetY} r="3.5" fill="#38bdf8" />
          </svg>
        </div>
      </div>

      {/* 4. COLLAPSIBLE ACCORDIONS: Ashtapor Homebrew Jump Calculator & Fall Damage Calculator */}
      <div className="space-y-1.5 shrink-0">
        {/* ACCORDION 1: ASHTAPOR JUMP CALCULATOR */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setActiveAccordion(activeAccordion === 'jump' ? 'none' : 'jump')}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer bg-slate-900/95"
          >
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-amber-400" />
              <span>Ashtapor Jump Calculator</span>
              <span className="text-[10px] font-mono text-emerald-400 font-semibold">
                {activeJumpDistance} ft ({hasRunningStart ? 'Running' : 'Standing'})
              </span>
            </div>
            {activeAccordion === 'jump' ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {activeAccordion === 'jump' && (
            <div className="p-3 border-t border-slate-800/80 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5 items-center">
                {/* STR Modifier input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">
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

                {/* DEX Modifier input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-300">
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

              {/* Jump Outputs display */}
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
                    <span className="text-lg font-mono font-bold text-amber-300">
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
                    <span className="text-lg font-mono font-bold text-cyan-300">
                      {runningJumpDistance} ft
                    </span>
                    <span className="text-[10px] text-slate-500">
                      (10 + {bestJumpMod >= 0 ? `+${bestJumpMod}` : bestJumpMod})
                    </span>
                  </div>
                </div>
              </div>

              {/* Required subtext */}
              <div className="text-[10px] text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800/70">
                No check required; limited by total movement speed.
              </div>
            </div>
          )}
        </div>

        {/* ACCORDION 2: ASHTAPOR FALL DAMAGE CALCULATOR */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setActiveAccordion(activeAccordion === 'fall' ? 'none' : 'fall')}
            className="w-full px-3 py-2 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-amber-300 transition cursor-pointer bg-slate-900/95"
          >
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              <span>Ashtapor Fall Damage Calculator</span>
              <span className="text-[10px] font-mono text-rose-400 font-semibold">
                Flat {flatFallDamage} HP
              </span>
            </div>
            {activeAccordion === 'fall' ? (
              <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            )}
          </button>

          {activeAccordion === 'fall' && (
            <div className="p-3 border-t border-slate-800/80 space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2.5 items-center">
                {/* Fall Distance Input */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Fall Distance (ft)
                  </label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setFallDistance((prev) => Math.max(0, prev - 5))}
                      className="h-7 w-7 rounded bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
                      title="-5 ft"
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
                      title="+5 ft"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Incapacitated Creature Checkbox */}
                <div className="flex flex-col justify-end pt-1">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 transition">
                    <input
                      type="checkbox"
                      checked={isIncapacitated}
                      onChange={(e) => setIsIncapacitated(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-rose-500 focus:ring-rose-500 cursor-pointer"
                    />
                    <div className="text-[11px] leading-tight">
                      <span className="font-semibold text-rose-300 block">Incapacitated Creature</span>
                      <span className="text-[9px] text-slate-400">1 flat dmg/ft from 0 ft</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Quick Distance Preset Buttons */}
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

              {/* Prominent Flat Fall Damage Output & 1-click log button */}
              <div className="p-3 rounded-lg bg-rose-950/30 border border-rose-600/50 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-rose-400/90 block">
                      Calculated Ashtapor Impact
                    </span>
                    <div className="text-base font-mono font-bold text-rose-200">
                      Flat Fall Damage: <span className="text-lg text-rose-400">{flatFallDamage} HP</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleLogFallDamage}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-md transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <Flame className="w-3.5 h-3.5" />
                    <span>Log to Live Feed</span>
                  </button>
                </div>

                <div className="text-[10px] text-rose-300/80 border-t border-rose-800/40 pt-1.5">
                  {isIncapacitated
                    ? 'Incapacitated fall: 1 flat damage per foot from 0 ft (takes full distance as damage).'
                    : fallDistance <= 15
                    ? 'Normal fall: ≤ 15 ft causes 0 damage (acrobatic recovery threshold).'
                    : `Normal fall: 0 damage for first 15 ft, then 1 flat damage per foot beyond 15 ft (${fallDistance} - 15 = ${flatFallDamage} HP).`}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
