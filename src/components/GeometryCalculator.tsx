import React, { useState, useMemo } from 'react';
import {
  Ruler,
  Compass,
  ArrowUpRight,
  Minus,
  Plus,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react';

export const GeometryCalculator: React.FC = () => {
  // Ground Distance & Target Altitude numeric states
  const [groundDistance, setGroundDistance] = useState<number>(40);
  const [altitudeDiff, setAltitudeDiff] = useState<number>(60);
  const [isRulesExpanded, setIsRulesExpanded] = useState<boolean>(false);

  // Exact 3D Euclidean Distance & 5e Tactical Grid Increments
  const trueDistance = Math.sqrt(
    groundDistance * groundDistance + altitudeDiff * altitudeDiff
  );
  const tactical5eRange = Math.ceil(trueDistance / 5) * 5;
  const gridSquares = tactical5eRange / 5;
  const formattedTrueDistance = Number.isInteger(trueDistance)
    ? trueDistance.toString()
    : trueDistance.toFixed(1);

  // Trajectory elevation pitch angle (degrees)
  const pitchAngleDegrees =
    groundDistance === 0
      ? altitudeDiff > 0
        ? 90
        : 0
      : Math.round(Math.atan2(altitudeDiff, groundDistance) * (180 / Math.PI));

  // Dynamic SVG Proportional Triangle Coordinates Calculation
  const svgData = useMemo(() => {
    const svgWidth = 440;
    const svgHeight = 200;
    const originX = 55;
    const originY = 165;
    const maxDrawWidth = 270;
    const maxDrawHeight = 115;

    const maxLeg = Math.max(groundDistance, altitudeDiff, 10);
    const scale = Math.min(maxDrawWidth / maxLeg, maxDrawHeight / maxLeg);

    const legX = groundDistance > 0 ? Math.max(35, groundDistance * scale) : 0;
    const legY = altitudeDiff > 0 ? Math.max(25, altitudeDiff * scale) : 0;

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
      legX,
      legY,
    };
  }, [groundDistance, altitudeDiff]);

  // Stepper handlers
  const handleGroundChange = (delta: number) => {
    setGroundDistance((prev) => Math.max(0, prev + delta));
  };

  const handleAltitudeChange = (delta: number) => {
    setAltitudeDiff((prev) => Math.max(0, prev + delta));
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#0b0f17] select-none p-3 gap-2.5">
      {/* 1. TOP: 2-COLUMN GRID with "Ground Distance (ft)" and "Target Altitude (ft)" number inputs */}
      <div className="grid grid-cols-2 gap-2.5 shrink-0">
        {/* Ground Distance Input Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="ground-input" className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <Compass className="w-3 h-3 text-amber-400" />
              <span>Ground (ft)</span>
            </label>
            <span className="text-[10px] font-mono text-amber-400/80">Horizontal</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleGroundChange(-5)}
              className="h-8 w-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="-5 ft"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              id="ground-input"
              type="number"
              min="0"
              step="5"
              value={groundDistance}
              onChange={(e) => setGroundDistance(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="flex-1 min-w-0 h-8 px-2 text-center text-sm font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400"
            />

            <button
              type="button"
              onClick={() => handleGroundChange(5)}
              className="h-8 w-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="+5 ft"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 pt-0.5">
            {[15, 30, 60, 120].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setGroundDistance(val)}
                className={`flex-1 py-0.5 text-[10px] font-mono rounded border transition cursor-pointer ${
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

        {/* Target Altitude Input Card */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 shadow-sm space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="altitude-input" className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3 text-cyan-400" />
              <span>Altitude (ft)</span>
            </label>
            <span className="text-[10px] font-mono text-cyan-400/80">Vertical</span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleAltitudeChange(-5)}
              className="h-8 w-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="-5 ft"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <input
              id="altitude-input"
              type="number"
              min="0"
              step="5"
              value={altitudeDiff}
              onChange={(e) => setAltitudeDiff(Math.max(0, parseInt(e.target.value, 10) || 0))}
              className="flex-1 min-w-0 h-8 px-2 text-center text-sm font-mono font-bold rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 focus:outline-none focus:border-cyan-400"
            />

            <button
              type="button"
              onClick={() => handleAltitudeChange(5)}
              className="h-8 w-8 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition cursor-pointer"
              title="+5 ft"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 pt-0.5">
            {[10, 30, 60, 100].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => setAltitudeDiff(val)}
                className={`flex-1 py-0.5 text-[10px] font-mono rounded border transition cursor-pointer ${
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

      {/* 2. CENTER: PROMINENT TACTICAL OUTPUT PILL ("Tactical Range: X ft" and "True: Y ft") */}
      <div className="p-2.5 rounded-xl bg-slate-900 border border-emerald-500/50 shadow-md flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-500/60 flex items-center justify-center text-emerald-400 shrink-0">
            <Ruler className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Tactical Range:
              </span>
              <span className="text-base font-mono font-bold text-emerald-300 tabular-nums">
                {tactical5eRange} ft
              </span>
              <span className="text-[11px] font-mono text-emerald-400/80">
                ({gridSquares} sq)
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              True: <strong className="text-amber-300">{formattedTrueDistance} ft</strong> · Pitch: {pitchAngleDegrees}°
            </div>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400 block">
            5e 5ft Grid RAW
          </span>
        </div>
      </div>

      {/* 3. BOTTOM: RESPONSIVE SVG RIGHT-TRIANGLE DIAGRAM (max-h-52) with dynamically labeled base, height, and hypotenuse */}
      <div className="flex-1 min-h-[190px] max-h-52 bg-slate-900/90 border border-slate-800 rounded-xl p-2 overflow-hidden flex flex-col shadow-sm">
        <div className="flex items-center justify-between pb-1 border-b border-slate-800/80 shrink-0">
          <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
            Live Proportional Trajectory
          </span>
          <span className="text-[10px] font-mono text-emerald-400 font-bold">
            Hypotenuse: {formattedTrueDistance} ft
          </span>
        </div>

        {/* Responsive SVG diagram */}
        <div className="flex-1 w-full h-full flex items-center justify-center relative overflow-hidden select-none">
          <svg
            viewBox={`0 0 ${svgData.svgWidth} ${svgData.svgHeight}`}
            className="w-full h-full max-h-52 block"
          >
            <defs>
              <pattern id="compact-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.6" />
              </pattern>
              <linearGradient id="hypo-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
              </linearGradient>
            </defs>

            {/* Grid Backdrop */}
            <rect width="100%" height="100%" fill="url(#compact-grid)" rx="6" />

            {/* Baseline dotted guide */}
            <line
              x1="25"
              y1={svgData.originY}
              x2={svgData.svgWidth - 25}
              y2={svgData.originY}
              stroke="#334155"
              strokeWidth="1"
              strokeDasharray="2 2"
            />

            {/* Triangle Area Fill */}
            {(groundDistance > 0 || altitudeDiff > 0) && (
              <polygon
                points={`${svgData.originX},${svgData.originY} ${svgData.cornerX},${svgData.cornerY} ${svgData.targetX},${svgData.targetY}`}
                fill="#10b981"
                fillOpacity="0.1"
              />
            )}

            {/* Right Angle Indicator */}
            {groundDistance > 0 && altitudeDiff > 0 && (
              <path
                d={`M ${svgData.cornerX - 10} ${svgData.cornerY} L ${svgData.cornerX - 10} ${svgData.cornerY - 10} L ${svgData.cornerX} ${svgData.cornerY - 10}`}
                fill="none"
                stroke="#475569"
                strokeWidth="1.2"
              />
            )}

            {/* Base Line (Ground Distance) */}
            <line
              x1={svgData.originX}
              y1={svgData.originY}
              x2={svgData.cornerX}
              y2={svgData.cornerY}
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Height Line (Target Altitude) */}
            <line
              x1={svgData.cornerX}
              y1={svgData.cornerY}
              x2={svgData.targetX}
              y2={svgData.targetY}
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Hypotenuse (Tactical 3D Distance) */}
            <line
              x1={svgData.originX}
              y1={svgData.originY}
              x2={svgData.targetX}
              y2={svgData.targetY}
              stroke="url(#hypo-grad)"
              strokeWidth="3"
              strokeLinecap="round"
            />

            {/* Base Label (Ground) */}
            <g transform={`translate(${svgData.midGroundX}, ${svgData.originY + 16})`}>
              <rect
                x="-45"
                y="-9"
                width="90"
                height="16"
                rx="3"
                fill="#0f172a"
                stroke="#f59e0b"
                strokeWidth="0.8"
              />
              <text
                x="0"
                y="1"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fbbf24"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                Base: {groundDistance} ft
              </text>
            </g>

            {/* Height Label (Altitude) */}
            <g transform={`translate(${svgData.targetX + 8}, ${svgData.midAltitudeY})`}>
              <rect
                x="0"
                y="-9"
                width="84"
                height="17"
                rx="3"
                fill="#0f172a"
                stroke="#38bdf8"
                strokeWidth="0.8"
              />
              <text
                x="42"
                y="1"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#38bdf8"
                fontSize="9"
                fontWeight="bold"
                fontFamily="monospace"
              >
                Height: {altitudeDiff} ft
              </text>
            </g>

            {/* Hypotenuse Label */}
            <g transform={`translate(${svgData.midHypotenuseX - 10}, ${svgData.midHypotenuseY - 14})`}>
              <rect
                x="-65"
                y="-10"
                width="130"
                height="18"
                rx="4"
                fill="#022c22"
                stroke="#10b981"
                strokeWidth="1.2"
              />
              <text
                x="0"
                y="0"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#34d399"
                fontSize="9.5"
                fontWeight="bold"
                fontFamily="monospace"
              >
                Tactical: {tactical5eRange} ft
              </text>
            </g>

            {/* Origin Marker */}
            <circle cx={svgData.originX} cy={svgData.originY} r="4.5" fill="#10b981" />
            <text
              x={svgData.originX - 6}
              y={svgData.originY + 14}
              textAnchor="end"
              fill="#94a3b8"
              fontSize="8.5"
              fontWeight="bold"
            >
              Origin
            </text>

            {/* Target Marker */}
            <circle cx={svgData.targetX} cy={svgData.targetY} r="4.5" fill="#38bdf8" />
            <text
              x={svgData.targetX}
              y={svgData.targetY - 8}
              textAnchor="middle"
              fill="#38bdf8"
              fontSize="8.5"
              fontWeight="bold"
            >
              Target
            </text>
          </svg>
        </div>
      </div>

      {/* OPTIONAL COLLAPSIBLE RULES DRAWER (Homebrew Fall & Jump Rules) */}
      <div className="shrink-0 border-t border-slate-800/80 pt-1">
        <button
          type="button"
          onClick={() => setIsRulesExpanded(!isRulesExpanded)}
          className="w-full py-1 px-2 text-[10px] text-slate-400 hover:text-slate-200 flex items-center justify-between rounded bg-slate-950/60 border border-slate-800/60 cursor-pointer"
        >
          <span className="flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-amber-400" />
            <span>Homebrew Quick Rules (Fall Damage &amp; Jumps)</span>
          </span>
          {isRulesExpanded ? (
            <ChevronUp className="w-3 h-3" />
          ) : (
            <ChevronDown className="w-3 h-3" />
          )}
        </button>

        {isRulesExpanded && (
          <div className="mt-1 p-2 rounded bg-slate-950 border border-slate-800 text-[10px] text-slate-300 space-y-1">
            <p>
              • <strong>Fall Damage:</strong> 1 flat dmg/ft beyond 15 ft buffer. (e.g. 30ft fall = 15 HP dmg). Incapacitated takes 1 dmg/ft from 0 ft.
            </p>
            <p>
              • <strong>Jumps:</strong> Standing = 5 ft + max(STR, DEX mod). Running (10ft lead) = 10 ft + max(STR, DEX mod). Capped by speed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
