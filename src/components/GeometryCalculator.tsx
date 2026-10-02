import React, { useState, useMemo } from 'react';
import {
  Ruler,
  Compass,
  Crosshair,
  ShieldAlert,
  Activity,
  ArrowUpRight,
  Layers,
} from 'lucide-react';

const COMMON_FALL_PRESETS = [
  { label: '10ft', ft: 10, note: 'Roof' },
  { label: '30ft', ft: 30, note: 'Cliff' },
  { label: '60ft', ft: 60, note: 'Tower' },
  { label: '120ft', ft: 120, note: 'Chasm' },
  { label: '200ft', ft: 200, note: 'RAW Cap' },
  { label: '300ft', ft: 300, note: 'Max Cap' },
];

export const GeometryCalculator: React.FC = () => {
  // Streamlined Interactive 3D Range Finder State (Direct 2-field numeric inputs)
  const [groundInput, setGroundInput] = useState<string>('40');
  const [altitudeInput, setAltitudeInput] = useState<string>('60');

  // Parsed numeric values
  const groundDistance = Math.max(0, parseFloat(groundInput) || 0);
  const altitudeDiff = Math.max(0, parseFloat(altitudeInput) || 0);

  // Exact 3D Euclidean Distance & 5e Tactical Grid Increments
  const trueDistance = Math.sqrt(groundDistance * groundDistance + altitudeDiff * altitudeDiff);
  const tactical5eRange = Math.ceil(trueDistance / 5) * 5;
  const gridSquares = tactical5eRange / 5;
  const formattedTrueDistance = Number.isInteger(trueDistance)
    ? trueDistance.toString()
    : trueDistance.toFixed(2);

  // Trajectory elevation pitch angle (degrees)
  const pitchAngleDegrees = groundDistance === 0
    ? (altitudeDiff > 0 ? 90 : 0)
    : Math.round(Math.atan2(altitudeDiff, groundDistance) * (180 / Math.PI));

  // Homebrew Fall Damage Calculator State (Scale up to 300 ft)
  const [fallFeet, setFallFeet] = useState<number>(30);
  const [fallFeetInput, setFallFeetInput] = useState<string>('30');
  const [isFallIncapacitated, setIsFallIncapacitated] = useState<boolean>(false);

  // Homebrew Jump Distance Calculator State
  const [strScore, setStrScore] = useState<number>(14);
  const [dexScore, setDexScore] = useState<number>(16);
  const [moveSpeed, setMoveSpeed] = useState<number>(30);

  // Handle Fall Height manual and slider inputs up to 300 ft
  const handleFallFeetChange = (valStr: string) => {
    setFallFeetInput(valStr);
    if (valStr.trim() !== '') {
      const parsed = parseInt(valStr, 10);
      if (!isNaN(parsed) && parsed >= 0) {
        setFallFeet(Math.min(300, parsed));
      }
    }
  };

  const handleFallFeetBlur = () => {
    const parsed = parseInt(fallFeetInput, 10);
    if (isNaN(parsed) || parsed < 0) {
      setFallFeet(0);
      setFallFeetInput('0');
    } else {
      const clamped = Math.min(300, parsed);
      setFallFeet(clamped);
      setFallFeetInput(clamped.toString());
    }
  };

  const handleSelectFallPreset = (ft: number) => {
    const clamped = Math.min(300, Math.max(0, ft));
    setFallFeet(clamped);
    setFallFeetInput(clamped.toString());
  };

  // Fall damage calculation
  // Rule: 1 flat damage per foot fallen beyond 15 feet. Incapacitated takes 1 damage per foot from 0 feet.
  const calculatedFallDamage = isFallIncapacitated
    ? Math.max(0, fallFeet)
    : Math.max(0, fallFeet - 15);

  // Standard 5e (RAW) Dice Scaling Comparison: 1d6 per 10 feet fallen up to 20d6 max (200+ ft cap)
  const raw5eD6Count = Math.min(20, Math.floor(fallFeet / 10));
  const raw5eAvgDmg = raw5eD6Count * 3.5;

  // Jump distance calculation
  const strMod = Math.floor((strScore - 10) / 2);
  const dexMod = Math.floor((dexScore - 10) / 2);
  const higherMod = Math.max(strMod, dexMod);

  const rawStandingJump = Math.max(0, 5 + higherMod);
  const rawRunningJump = Math.max(0, 10 + higherMod);

  const standingJumpCapped = Math.min(moveSpeed, rawStandingJump);
  const runningJumpCapped = Math.min(Math.max(0, moveSpeed - 10), rawRunningJump);

  // Dynamic SVG Proportional Triangle Coordinates Calculation
  const svgGeometry = useMemo(() => {
    const svgWidth = 560;
    const svgHeight = 320;
    const originX = 75;
    const originY = 255;
    const maxDrawWidth = 320;
    const maxDrawHeight = 190;

    const maxDim = Math.max(groundDistance, altitudeDiff, 1);
    const scale = Math.min(maxDrawWidth / maxDim, maxDrawHeight / maxDim);

    let legX = groundDistance * scale;
    let legY = altitudeDiff * scale;

    // Minimum visual size for readability if > 0
    if (groundDistance > 0 && legX < 50) legX = 50;
    if (altitudeDiff > 0 && legY < 50) legY = 50;

    const cornerX = originX + legX;
    const cornerY = originY;
    const targetX = cornerX;
    const targetY = originY - legY;

    // Midpoints for labels
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

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold text-slate-100 font-display tracking-wide">
              3D Geometry &amp; Movement Suite
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Calculate true Euclidean 3D ranges, pitch angles, homebrew fall damage (1 flat dmg/ft beyond 15ft), and streamlined jump distances.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Tactical 5e Grid Increments: <strong className="text-cyan-300 font-bold">{tactical5eRange} ft ({gridSquares} sq)</strong></span>
        </div>
      </div>

      {/* TOP ROW: Streamlined 3D Range Finder & Dynamic Triangle Diagram */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Clean Two-Field Input Card & Tactical Outputs */}
        <div className="lg:col-span-5 space-y-5">
          {/* Two-Field Input Card */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider font-display">
                  3D Range Finder
                </h3>
              </div>
              <span className="text-[11px] font-mono text-cyan-300 font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60">
                Pythagorean Engine
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Enter the horizontal battle grid distance and target vertical elevation difference to calculate true direct line-of-sight and 5e grid increments.
            </p>

            <div className="space-y-4 pt-1">
              {/* Field 1: Ground Distance (ft) */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="ground-distance-input" className="text-xs font-semibold text-slate-200">
                    Ground Distance (ft)
                  </label>
                  <span className="text-[10px] font-mono text-amber-400/80">Horizontal Leg</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="ground-distance-input"
                    type="number"
                    min="0"
                    step="1"
                    value={groundInput}
                    onChange={(e) => setGroundInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-base font-mono font-bold rounded-lg bg-slate-900 border border-slate-700 text-amber-300 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 transition-all pr-12"
                    placeholder="e.g. 40"
                  />
                  <span className="absolute right-3.5 text-xs font-mono font-semibold text-slate-400 pointer-events-none">
                    ft
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-500 font-mono">Quick:</span>
                  {[15, 30, 60, 120].map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setGroundInput(ft.toString())}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                        groundDistance === ft
                          ? 'bg-amber-400 text-slate-950 font-bold border-amber-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {ft}ft
                    </button>
                  ))}
                </div>
              </div>

              {/* Field 2: Target Altitude Difference (ft) */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="altitude-diff-input" className="text-xs font-semibold text-slate-200">
                    Target Altitude Difference (ft)
                  </label>
                  <span className="text-[10px] font-mono text-cyan-400/80">Vertical Leg</span>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="altitude-diff-input"
                    type="number"
                    min="0"
                    step="1"
                    value={altitudeInput}
                    onChange={(e) => setAltitudeInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-base font-mono font-bold rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/30 transition-all pr-12"
                    placeholder="e.g. 60"
                  />
                  <span className="absolute right-3.5 text-xs font-mono font-semibold text-slate-400 pointer-events-none">
                    ft
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-slate-500 font-mono">Quick:</span>
                  {[10, 30, 60, 100].map((ft) => (
                    <button
                      key={ft}
                      type="button"
                      onClick={() => setAltitudeInput(ft.toString())}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border transition cursor-pointer ${
                        altitudeDiff === ft
                          ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {ft}ft
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Tactical Output Prominently Displayed Beneath Inputs */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display flex items-center gap-2">
              <Crosshair className="w-3.5 h-3.5 text-emerald-400" />
              Tactical Output
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* True Distance */}
              <div className="p-4 rounded-xl bg-slate-950 border border-amber-500/40 space-y-1.5 shadow-sm">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">
                  True Distance
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono text-amber-300 tabular-nums">
                    {formattedTrueDistance}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-400">ft</span>
                </div>
                <span className="text-[10px] text-slate-500 block font-mono">
                  Math.sqrt({groundDistance}² + {altitudeDiff}²) ft
                </span>
              </div>

              {/* Tactical 5e Range */}
              <div className="p-4 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-1.5 shadow-sm">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block font-mono">
                  Tactical 5e Range
                </span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold font-mono text-cyan-300 tabular-nums">
                    {tactical5eRange}
                  </span>
                  <span className="text-xs font-mono font-semibold text-slate-400">ft</span>
                  <span className="text-[10px] font-sans font-medium text-cyan-400/90 ml-1">
                    ({gridSquares} sq)
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 block font-mono">
                  Rounded up to 5-foot grid increments
                </span>
              </div>
            </div>

            {/* Tactical Reference Summary */}
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-mono">
                  Trajectory Pitch: <strong className="text-amber-300">{pitchAngleDegrees}°</strong>
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                Standard 5e RAW: <strong className="text-slate-200">{Math.max(groundDistance, altitudeDiff)} ft</strong> (Cube rule)
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic 3D Triangle Diagram */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
                  Dynamic 3D Triangle Diagram
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Live Proportional Projection
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Visualizes the horizontal leg, elevation altitude leg, and calculated hypotenuse scaled to exact proportions.
            </p>

            {/* SVG Visualizer */}
            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center p-3 relative">
              <svg
                viewBox={`0 0 ${svgGeometry.svgWidth} ${svgGeometry.svgHeight}`}
                className="w-full h-auto max-h-[360px] block select-none"
              >
                <defs>
                  {/* Tactical Grid Background Pattern */}
                  <pattern id="tactical-grid-pattern" width="25" height="25" patternUnits="userSpaceOnUse">
                    <path d="M 25 0 L 0 0 0 25" fill="none" stroke="#1e293b" strokeWidth="0.8" />
                  </pattern>

                  {/* Linear Gradient for Hypotenuse Glow */}
                  <linearGradient id="hypotenuse-glow" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#34d399" />
                  </linearGradient>

                  {/* Gradient for Triangle Area */}
                  <linearGradient id="triangle-fill-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.05" />
                  </linearGradient>
                </defs>

                {/* Grid Canvas */}
                <rect width="100%" height="100%" fill="url(#tactical-grid-pattern)" rx="8" />

                {/* Ground Baseline Axis across full canvas */}
                <line
                  x1="30"
                  y1={svgGeometry.originY}
                  x2={svgGeometry.svgWidth - 30}
                  y2={svgGeometry.originY}
                  stroke="#334155"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Triangle Area Fill */}
                {(groundDistance > 0 || altitudeDiff > 0) && (
                  <polygon
                    points={`${svgGeometry.originX},${svgGeometry.originY} ${svgGeometry.cornerX},${svgGeometry.cornerY} ${svgGeometry.targetX},${svgGeometry.targetY}`}
                    fill="url(#triangle-fill-grad)"
                  />
                )}

                {/* Right Angle Indicator */}
                {groundDistance > 0 && altitudeDiff > 0 && (
                  <path
                    d={`M ${svgGeometry.cornerX - 14} ${svgGeometry.cornerY} L ${svgGeometry.cornerX - 14} ${svgGeometry.cornerY - 14} L ${svgGeometry.cornerX} ${svgGeometry.cornerY - 14}`}
                    fill="none"
                    stroke="#475569"
                    strokeWidth="1.5"
                  />
                )}

                {/* Elevation Pitch Angle Arc at Origin */}
                {groundDistance > 0 && altitudeDiff > 0 && (
                  <g>
                    <path
                      d={`M ${svgGeometry.originX + 28} ${svgGeometry.originY} A 28 28 0 0 0 ${
                        svgGeometry.originX + 28 * Math.cos(pitchAngleDegrees * (Math.PI / 180))
                      } ${svgGeometry.originY - 28 * Math.sin(pitchAngleDegrees * (Math.PI / 180))}`}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="1.5"
                    />
                    <text
                      x={svgGeometry.originX + 34}
                      y={svgGeometry.originY - 6}
                      fill="#fbbf24"
                      fontSize="10"
                      fontWeight="bold"
                      fontFamily="monospace"
                    >
                      {pitchAngleDegrees}°
                    </text>
                  </g>
                )}

                {/* 1. Horizontal Leg (Ground Distance) */}
                <line
                  x1={svgGeometry.originX}
                  y1={svgGeometry.originY}
                  x2={svgGeometry.cornerX}
                  y2={svgGeometry.cornerY}
                  stroke="#f59e0b"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Horizontal Leg Dynamic Label */}
                <g transform={`translate(${svgGeometry.midGroundX}, ${svgGeometry.originY + 24})`}>
                  <rect
                    x="-75"
                    y="-13"
                    width="150"
                    height="22"
                    rx="4"
                    fill="#0f172a"
                    stroke="#f59e0b"
                    strokeWidth="1"
                    strokeOpacity="0.8"
                  />
                  <text
                    x="0"
                    y="1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fbbf24"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    Ground: {groundDistance} ft
                  </text>
                </g>

                {/* 2. Vertical Leg (Target Altitude Difference) */}
                <line
                  x1={svgGeometry.cornerX}
                  y1={svgGeometry.cornerY}
                  x2={svgGeometry.targetX}
                  y2={svgGeometry.targetY}
                  stroke="#38bdf8"
                  strokeWidth="3"
                  strokeLinecap="round"
                />

                {/* Vertical Leg Dynamic Label */}
                <g transform={`translate(${svgGeometry.targetX + 16}, ${svgGeometry.midAltitudeY})`}>
                  <rect
                    x="0"
                    y="-12"
                    width="135"
                    height="24"
                    rx="4"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="1"
                    strokeOpacity="0.8"
                  />
                  <text
                    x="67.5"
                    y="1"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#38bdf8"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    Altitude: {altitudeDiff} ft
                  </text>
                </g>

                {/* 3. Hypotenuse (Tactical 3D Distance Line) */}
                <line
                  x1={svgGeometry.originX}
                  y1={svgGeometry.originY}
                  x2={svgGeometry.targetX}
                  y2={svgGeometry.targetY}
                  stroke="url(#hypotenuse-glow)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />

                {/* Hypotenuse Dynamic Label (Tactical 5e Range) */}
                <g transform={`translate(${svgGeometry.midHypotenuseX}, ${svgGeometry.midHypotenuseY - 18})`}>
                  <rect
                    x="-106"
                    y="-14"
                    width="212"
                    height="26"
                    rx="6"
                    fill="#022c22"
                    stroke="#10b981"
                    strokeWidth="1.5"
                    className="shadow-lg"
                  />
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#34d399"
                    fontSize="11"
                    fontWeight="bold"
                    fontFamily="monospace"
                  >
                    Tactical 5e Range: {tactical5eRange} ft
                  </text>
                </g>

                {/* Origin Point Marker (Attacker / Shooter) */}
                <circle
                  cx={svgGeometry.originX}
                  cy={svgGeometry.originY}
                  r="6"
                  fill="#10b981"
                  stroke="#022c22"
                  strokeWidth="2"
                />
                <circle
                  cx={svgGeometry.originX}
                  cy={svgGeometry.originY}
                  r="10"
                  fill="none"
                  stroke="#10b981"
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />
                <text
                  x={svgGeometry.originX - 10}
                  y={svgGeometry.originY + 22}
                  textAnchor="end"
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  Origin (0 ft)
                </text>

                {/* Target Point Marker (Flying Target / High Ground) */}
                <circle
                  cx={svgGeometry.targetX}
                  cy={svgGeometry.targetY}
                  r="6"
                  fill="#38bdf8"
                  stroke="#082f49"
                  strokeWidth="2"
                />
                <circle
                  cx={svgGeometry.targetX}
                  cy={svgGeometry.targetY}
                  r="11"
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="1"
                  strokeOpacity="0.5"
                />
                <text
                  x={svgGeometry.targetX + 12}
                  y={svgGeometry.targetY - 8}
                  textAnchor="start"
                  fill="#cbd5e1"
                  fontSize="10"
                  fontWeight="bold"
                  fontFamily="sans-serif"
                >
                  Target (+{altitudeDiff} ft)
                </text>
              </svg>
            </div>

            {/* Diagram Legend & Guide */}
            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Origin (Attacker)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block" /> Elevated Target
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-amber-400 inline-block" /> Ground
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-cyan-400 inline-block" /> Altitude
                </span>
              </div>
              <span className="font-mono text-emerald-400">
                True Hypotenuse: {formattedTrueDistance} ft
              </span>
            </div>
          </div>
        </div>

      </div>

      {/* BOTTOM ROW: MOVED HOMEBREW FALL DAMAGE & JUMP DISTANCE CALCULATORS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        
        {/* 1. HOMEBREW FALL DAMAGE CALCULATOR */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              <h3 className="text-sm font-bold text-slate-100 font-display">
                Homebrew Fall Damage Calculator
              </h3>
            </div>
            <span className="text-[11px] text-rose-300 font-mono">1 flat dmg / ft past 15ft</span>
          </div>

          <p className="text-xs text-slate-400">
            <strong>Rule:</strong> 1 flat damage per foot fallen beyond 15 feet. Incapacitated creatures take 1 damage per foot starting from 0 feet.
          </p>

          <div className="space-y-3.5 text-xs">
            {/* Fall Height Slider & Direct Numeric Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Fall Height (0 - 300 ft):</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    max="300"
                    step="5"
                    value={fallFeetInput}
                    onChange={(e) => handleFallFeetChange(e.target.value)}
                    onBlur={handleFallFeetBlur}
                    className="w-20 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg bg-slate-950 border border-slate-700 text-amber-300 focus:outline-none focus:border-rose-400"
                  />
                  <span className="text-xs font-mono text-slate-400">ft</span>
                </div>
              </div>

              <input
                type="range"
                min="0"
                max="300"
                step="5"
                value={fallFeet}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10) || 0;
                  setFallFeet(val);
                  setFallFeetInput(val.toString());
                }}
                className="w-full accent-rose-400 cursor-pointer"
              />

              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0 ft (Safe)</span>
                <span>15 ft (Buffer)</span>
                <span>100 ft</span>
                <span>200 ft (RAW 20d6)</span>
                <span>300 ft (Max)</span>
              </div>

              {/* Quick Fall Benchmarks */}
              <div className="pt-1">
                <span className="text-[10px] text-slate-400 block mb-1 font-medium">Quick Fall Benchmarks:</span>
                <div className="flex flex-wrap gap-1">
                  {COMMON_FALL_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSelectFallPreset(p.ft)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        fallFeet === p.ft
                          ? 'bg-rose-500 text-white font-bold border-rose-400 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                      }`}
                    >
                      {p.label} ({p.note})
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer pt-1 bg-slate-950 p-2 rounded-lg border border-slate-800">
              <input
                type="checkbox"
                checked={isFallIncapacitated}
                onChange={(e) => setIsFallIncapacitated(e.target.checked)}
                className="rounded bg-slate-900 border-slate-700 text-rose-400 focus:ring-0 cursor-pointer"
              />
              <span className="text-slate-300 text-xs">
                Creature is <strong>Incapacitated</strong> (Takes 1 dmg/ft from 0 ft, no 15ft buffer)
              </span>
            </label>

            {/* Results & 5e RAW Comparison */}
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Homebrew Flat Damage</span>
                  <span className="text-2xl font-bold font-mono text-rose-400 tabular-nums">
                    {calculatedFallDamage} HP
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-medium">Standard 5e (RAW)</span>
                  <span className="text-sm font-bold font-mono text-amber-300">
                    {raw5eD6Count > 0 ? `${raw5eD6Count}d6 (~${raw5eAvgDmg} avg)` : '0d6 (No dmg)'}
                  </span>
                  {fallFeet >= 200 && (
                    <span className="text-[9px] text-amber-400/80 block font-mono">5e RAW capped at 20d6</span>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                <span>
                  {isFallIncapacitated
                    ? `${fallFeet} ft × 1 flat dmg = ${calculatedFallDamage} dmg`
                    : fallFeet <= 15
                    ? `Safe landing within 15ft buffer (0 dmg)`
                    : `(${fallFeet} ft - 15 ft buffer) × 1 flat dmg = ${calculatedFallDamage} dmg`}
                </span>
                <span className="text-[10px] font-sans font-semibold px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  {fallFeet <= 15
                    ? '🟢 Safe Landing'
                    : fallFeet <= 60
                    ? '🟡 Moderate Fall'
                    : fallFeet <= 120
                    ? '🟠 Severe High Fall'
                    : fallFeet <= 200
                    ? '🔴 Critical Altitude'
                    : '💀 Terminal Altitude Impact'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. HOMEBREW JUMP DISTANCE CALCULATOR */}
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-slate-100 font-display">
                Homebrew Jump Distance Calculator
              </h3>
            </div>
            <span className="text-[11px] text-cyan-300 font-mono">No Check Required</span>
          </div>

          <p className="text-xs text-slate-400">
            <strong>Rule:</strong> Limited only by total movement speed.<br />
            • <strong>Standing:</strong> 5 ft. + higher of STR/DEX mod.<br />
            • <strong>Running (10-ft lead):</strong> 10 ft. + higher of STR/DEX mod.
          </p>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  STR Score ({strMod >= 0 ? `+${strMod}` : strMod})
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={strScore}
                  onChange={(e) => setStrScore(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  DEX Score ({dexMod >= 0 ? `+${dexMod}` : dexMod})
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={dexScore}
                  onChange={(e) => setDexScore(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Speed (ft)
                </label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={moveSpeed}
                  onChange={(e) => setMoveSpeed(parseInt(e.target.value, 10) || 30)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold rounded bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="text-[11px] text-slate-400 italic">
              Using higher modifier: <strong className="text-amber-300">{higherMod >= 0 ? `+${higherMod}` : higherMod}</strong> ({strMod >= dexMod ? 'Strength' : 'Dexterity'})
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Standing Jump</span>
                <span className="text-xl font-bold font-mono text-cyan-300">
                  {standingJumpCapped} ft
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">5 ft + {higherMod >= 0 ? `+${higherMod}` : higherMod}</span>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Running Jump (10ft lead)</span>
                <span className="text-xl font-bold font-mono text-emerald-300">
                  {runningJumpCapped} ft
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">10 ft + {higherMod >= 0 ? `+${higherMod}` : higherMod}</span>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400">
              💡 <em>Prone / Duck / Crouch:</em> Dropping, crawling, or clearing improvised maneuvers costs a flat <strong>15 feet of movement</strong>.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
