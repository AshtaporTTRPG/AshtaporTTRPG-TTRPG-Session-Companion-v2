import React, { useState, useRef, useEffect, useMemo } from 'react';
import { calculate3DDistance } from '../utils/geometry';
import {
  Ruler,
  Compass,
  Crosshair,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowUpRight,
  ShieldAlert,
  Zap,
  Swords,
  Sparkles,
  Check,
} from 'lucide-react';
import { SliderWithNumberInput } from './SliderWithNumberInput';
import {
  WEAPON_RANGE_PRESETS,
  SPELL_RANGE_PRESETS,
  WeaponRangePreset,
  SpellRangePreset,
} from '../utils/rangePresets';

const COMMON_FALL_PRESETS = [
  { label: '10ft', ft: 10, note: 'Roof' },
  { label: '30ft', ft: 30, note: 'Cliff' },
  { label: '60ft', ft: 60, note: 'Tower' },
  { label: '120ft', ft: 120, note: 'Chasm' },
  { label: '200ft', ft: 200, note: 'RAW Cap' },
  { label: '300ft', ft: 300, note: 'Max Cap' },
];

// Expanded 500 ft x 500 ft milestones for 3D Pythagorean Cheat Table
const CHEAT_TABLE_GROUND = [25, 50, 75, 100, 150, 200, 250, 300, 400, 500];
const CHEAT_TABLE_HEIGHT = [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500];

export const GeometryCalculator: React.FC = () => {
  // 3D Distance State (0 to 500 ft range)
  const [horizontalDist, setHorizontalDist] = useState<number>(40);
  const [sourceElev, setSourceElev] = useState<number>(0);
  const [targetElev, setTargetElev] = useState<number>(60);
  const [rangeLimit, setRangeLimit] = useState<number>(60);
  const [presetCategory, setPresetCategory] = useState<'weapons' | 'spells' | 'all'>('weapons');

  // Homebrew Fall Damage Calculator State (Scale up to 300 ft)
  const [fallFeet, setFallFeet] = useState<number>(30);
  const [fallFeetInput, setFallFeetInput] = useState<string>('30');
  const [isFallIncapacitated, setIsFallIncapacitated] = useState<boolean>(false);

  // Homebrew Jump Distance Calculator State
  const [strScore, setStrScore] = useState<number>(14);
  const [dexScore, setDexScore] = useState<number>(16);
  const [moveSpeed, setMoveSpeed] = useState<number>(30);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const handleSelectPresetRange = (range: number) => {
    setRangeLimit(range);
  };

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

  // 3D Distance calculations
  const distanceResults = useMemo(() => {
    return calculate3DDistance({
      horizontalDistance: horizontalDist,
      sourceElevation: sourceElev,
      targetElevation: targetElev,
      rangeLimit,
    });
  }, [horizontalDist, sourceElev, targetElev, rangeLimit]);

  const deltaElevation = Math.abs(targetElev - sourceElev);
  const isInRange = distanceResults.euclideanDistance <= rangeLimit;
  const standard5eDist = Math.max(horizontalDist, deltaElevation);
  const alternateDiagonalDist = distanceResults.alternateDiagonalDistance;

  // Closest milestones in the 500ft x 500ft Cheat Matrix for active cell highlighting
  const closestGround = useMemo(() => {
    return CHEAT_TABLE_GROUND.reduce((prev, curr) =>
      Math.abs(curr - horizontalDist) < Math.abs(prev - horizontalDist) ? curr : prev
    );
  }, [horizontalDist]);

  const closestHeight = useMemo(() => {
    return CHEAT_TABLE_HEIGHT.reduce((prev, curr) =>
      Math.abs(curr - deltaElevation) < Math.abs(prev - deltaElevation) ? curr : prev
    );
  }, [deltaElevation]);

  // Fall damage calculation
  // Rule: 1 flat damage per foot fallen beyond 15 feet. Incapacitated takes 1 damage per foot from 0 feet.
  // Scales smoothly up to 300 ft without truncation.
  const calculatedFallDamage = isFallIncapacitated
    ? Math.max(0, fallFeet)
    : Math.max(0, fallFeet - 15);

  // Standard 5e (RAW) Dice Scaling Comparison: 1d6 per 10 feet fallen up to 20d6 max (200+ ft cap)
  const raw5eD6Count = Math.min(20, Math.floor(fallFeet / 10));
  const raw5eAvgDmg = raw5eD6Count * 3.5;

  // Jump distance calculation
  // Rule: No check required; limited by total movement speed.
  // Standing: 5 ft. + STR or DEX modifier (whichever is higher).
  // Running (10-ft lead): 10 ft. + STR or DEX modifier (whichever is higher).
  const strMod = Math.floor((strScore - 10) / 2);
  const dexMod = Math.floor((dexScore - 10) / 2);
  const higherMod = Math.max(strMod, dexMod);

  const rawStandingJump = Math.max(0, 5 + higherMod);
  const rawRunningJump = Math.max(0, 10 + higherMod);

  // Cap at remaining movement speed (for running jump, uses 10 ft of movement for lead)
  const standingJumpCapped = Math.min(moveSpeed, rawStandingJump);
  const runningJumpCapped = Math.min(Math.max(0, moveSpeed - 10), rawRunningJump);

  // Canvas visualizer for 3D elevation vector diagram
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    animId = requestAnimationFrame(() => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Subtle tactical grid background to eliminate dead empty space
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      const gridStep = 45;
      for (let x = 0; x < width; x += gridStep) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Origin and dynamic scaling
      const originX = 65;
      const originY = height - 45;
      const maxDim = Math.max(horizontalDist, deltaElevation, rangeLimit > 0 ? rangeLimit : 50, 50);
      const scale = Math.min((width - 130) / maxDim, (height - 90) / maxDim);

      const targetX = originX + horizontalDist * scale;
      const targetY = originY - (targetElev - sourceElev) * scale;

      // Draw Range Sphere / Arc (Weapon / Spell Max Range Coverage)
      if (rangeLimit > 0) {
        const radiusPx = rangeLimit * scale;
        ctx.save();
        ctx.beginPath();
        ctx.arc(originX, originY, radiusPx, 0, -Math.PI / 2, true);
        ctx.strokeStyle = isInRange ? 'rgba(52, 211, 153, 0.4)' : 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.stroke();
        ctx.fillStyle = isInRange ? 'rgba(52, 211, 153, 0.04)' : 'rgba(239, 68, 68, 0.04)';
        ctx.lineTo(originX, originY);
        ctx.closePath();
        ctx.fill();
        ctx.restore();

        // Label for Range Arc
        ctx.fillStyle = isInRange ? '#34d399' : '#f87171';
        ctx.font = 'bold 9px system-ui, sans-serif';
        const labelAngle = -Math.PI / 4;
        const arcLabelX = originX + Math.cos(labelAngle) * Math.min(radiusPx, width - 110);
        const arcLabelY = originY + Math.sin(labelAngle) * Math.min(radiusPx, height - 80);
        if (arcLabelX > 20 && arcLabelY > 15) {
          ctx.fillText(`Max Range: ${rangeLimit}ft`, arcLabelX - 25, arcLabelY - 5);
        }
      }

      // Draw Ground / Baseline
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(20, originY);
      ctx.lineTo(width - 20, originY);
      ctx.stroke();

      // Horizontal Distance Line (Dashed)
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(targetX, originY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Vertical Altitude Line
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(targetX, originY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Hypotenuse (True 3D Direct Line of Sight)
      ctx.strokeStyle = isInRange ? '#10b981' : '#ef4444';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(originX, originY);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Source point (Shooter / Caster)
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(originX, originY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#064e3b';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Target point (Flying Creature / High Ground)
      ctx.fillStyle = isInRange ? '#10b981' : '#ef4444';
      ctx.beginPath();
      ctx.arc(targetX, targetY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = isInRange ? '#064e3b' : '#7f1d1d';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Text Annotations
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`Origin (${sourceElev}ft)`, originX - 45, originY + 22);
      ctx.fillText(`Target (${targetElev}ft)`, targetX - 35, targetY - 12);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`Ground: ${horizontalDist}ft`, (originX + targetX) / 2 - 30, originY + 16);
      ctx.fillText(`Height Δ: ${deltaElevation}ft`, targetX + 10, (originY + targetY) / 2);

      // True 3D Distance Label on the Hypotenuse
      const midX = (originX + targetX) / 2;
      const midY = (originY + targetY) / 2;
      ctx.fillStyle = isInRange ? '#34d399' : '#f87171';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText(`3D: ${distanceResults.euclideanDistance}ft`, midX - 30, midY - 10);

      // Angle Arc
      if (deltaElevation > 0 && horizontalDist > 0) {
        const angleRad = distanceResults.pitchAngleDegrees * (Math.PI / 180);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(originX, originY, 28, 0, targetElev >= sourceElev ? -angleRad : angleRad, targetElev >= sourceElev);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.fillText(`${distanceResults.pitchAngleDegrees}°`, originX + 32, originY - 6);
      }
    });

    return () => cancelAnimationFrame(animId);
  }, [horizontalDist, sourceElev, targetElev, rangeLimit, distanceResults, deltaElevation, isInRange]);

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

        {/* In Range / Out of Range Badge */}
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-xl border font-bold text-xs shadow-md ${
            isInRange
              ? 'bg-emerald-950/80 border-emerald-500/80 text-emerald-200'
              : 'bg-red-950/80 border-red-500/80 text-red-200'
          }`}
        >
          {isInRange ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>3D TARGET IN RANGE ({distanceResults.euclideanDistance}ft ≤ {rangeLimit}ft)</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span>TARGET OUT OF RANGE ({distanceResults.euclideanDistance}ft &gt; {rangeLimit}ft)</span>
            </>
          )}
        </div>
      </div>

      {/* TOP ROW: 3D Triangulation & Elevation Vector Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Elevation & Range Inputs */}
        <div className="lg:col-span-5 space-y-5">
          {/* Controls Card */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-xs font-bold text-amber-300 uppercase tracking-wider font-display">
              Elevation &amp; Range Inputs
            </h3>

            {/* Horizontal Ground Distance (0 to 500 ft) */}
            <SliderWithNumberInput
              label="Horizontal Ground Distance"
              helperText="Target distance on the 2D battle grid"
              min={0}
              max={500}
              step={5}
              unit="ft"
              value={horizontalDist}
              onChange={setHorizontalDist}
              accentColor="amber"
              quickPresets={[30, 60, 100, 150, 300, 500]}
            />

            {/* Origin & Target Elevation Dual Controls */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <SliderWithNumberInput
                label="Origin Elevation"
                helperText="Attacker / Caster altitude"
                min={0}
                max={500}
                step={5}
                unit="ft"
                value={sourceElev}
                onChange={setSourceElev}
                accentColor="emerald"
                quickPresets={[0, 10, 20, 50, 100]}
              />

              <SliderWithNumberInput
                label="Target Elevation"
                helperText="Flying / High ground altitude"
                min={0}
                max={500}
                step={5}
                unit="ft"
                value={targetElev}
                onChange={setTargetElev}
                accentColor="cyan"
                quickPresets={[0, 30, 60, 120, 300, 500]}
              />
            </div>

            {/* Range / AOE Dual Control */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <SliderWithNumberInput
                label="Range / AOE"
                helperText="Maximum effective weapon reach, spell range, or AOE radius"
                min={0}
                max={600}
                step={5}
                unit="ft"
                value={rangeLimit}
                onChange={setRangeLimit}
                accentColor="amber"
                quickPresets={[5, 30, 60, 120, 150, 300, 600]}
              />

              {/* Matched preset indicator */}
              {(() => {
                const matchedWeapon = WEAPON_RANGE_PRESETS.find(
                  (p) => p.normalRange === rangeLimit || p.longRange === rangeLimit
                );
                const matchedSpell = SPELL_RANGE_PRESETS.find((p) => p.range === rangeLimit);
                if (matchedWeapon) {
                  const isLong = matchedWeapon.longRange === rangeLimit;
                  return (
                    <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-mono bg-amber-950/40 px-2 py-1 rounded border border-amber-800/40">
                      <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>
                        Preset: <strong>{matchedWeapon.classification}</strong> {isLong ? '(Max)' : '(Normal)'} — {matchedWeapon.items.join(', ')}
                      </span>
                    </div>
                  );
                }
                if (matchedSpell) {
                  return (
                    <div className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-mono bg-cyan-950/40 px-2 py-1 rounded border border-cyan-800/40">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>
                        Preset: <strong>{matchedSpell.classification} ({matchedSpell.range}ft)</strong> — {matchedSpell.items.join(', ')}
                      </span>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Standardized Quick Range Presets */}
              <div className="pt-2 border-t border-slate-800/80 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Standardized Range Presets</span>
                  <span className="text-[11px] text-slate-400 font-mono">
                    Ascending range • Alphabetical items
                  </span>
                </div>

                {/* Category Switcher Tabs */}
                <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => setPresetCategory('weapons')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md font-medium transition-colors cursor-pointer text-[11px] ${
                      presetCategory === 'weapons'
                        ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Swords className="w-3 h-3 text-amber-400" />
                    <span>Weapons</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetCategory('spells')}
                    className={`flex items-center justify-center gap-1.5 py-1 px-2 rounded-md font-medium transition-colors cursor-pointer text-[11px] ${
                      presetCategory === 'spells'
                        ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <Sparkles className="w-3 h-3 text-cyan-400" />
                    <span>Spells</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPresetCategory('all')}
                    className={`flex items-center justify-center py-1 px-2 rounded-md font-medium transition-colors cursor-pointer text-[11px] ${
                      presetCategory === 'all'
                        ? 'bg-slate-800 text-slate-100 font-bold border border-slate-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                    }`}
                  >
                    <span>All Presets</span>
                  </button>
                </div>

                {/* Presets List in Ascending Order */}
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                  {/* Category A: Weapons & Attacks */}
                  {(presetCategory === 'weapons' || presetCategory === 'all') && (
                    <div className="space-y-1.5">
                      {presetCategory === 'all' && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-wider pt-1">
                          <Swords className="w-3 h-3" />
                          <span>Weapons &amp; Attacks</span>
                        </div>
                      )}
                      {WEAPON_RANGE_PRESETS.map((p) => {
                        const isNormalActive = rangeLimit === p.normalRange;
                        const isLongActive = p.longRange !== undefined && rangeLimit === p.longRange;
                        const isAnyActive = isNormalActive || isLongActive;

                        return (
                          <div
                            key={p.id}
                            className={`p-2 rounded-lg border transition-all text-xs ${
                              isAnyActive
                                ? 'bg-amber-950/40 border-amber-500/60 shadow-sm'
                                : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[11px] bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  {p.rangeLabel}
                                </span>
                                <span className="font-semibold text-slate-200 text-[11px]">
                                  {p.classification}
                                </span>
                              </div>

                              {/* Range selection buttons for dual-range or single-range */}
                              {p.longRange !== undefined ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSelectPresetRange(p.normalRange)}
                                    title={`Set normal range: ${p.normalRange} ft`}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                                      isNormalActive
                                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 shadow-sm'
                                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400/50 hover:text-amber-200'
                                    }`}
                                  >
                                    Normal ({p.normalRange}ft)
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSelectPresetRange(p.longRange!)}
                                    title={`Set max / long range: ${p.longRange} ft`}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                                      isLongActive
                                        ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 shadow-sm'
                                        : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400/50 hover:text-amber-200'
                                    }`}
                                  >
                                    Max ({p.longRange}ft)
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectPresetRange(p.normalRange)}
                                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                                    isNormalActive
                                      ? 'bg-amber-400 text-slate-950 font-bold border-amber-300 shadow-sm'
                                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-amber-400/50 hover:text-amber-200'
                                  }`}
                                >
                                  Select ({p.normalRange}ft)
                                </button>
                              )}
                            </div>

                            {/* Alphabetical list of examples */}
                            <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                              <span className="text-[10px] text-slate-400 font-medium">Examples:</span>
                              {p.items.map((item) => (
                                <span
                                  key={item}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/90 text-slate-300 border border-slate-800 font-sans"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Category B: Spells & Magical Effects */}
                  {(presetCategory === 'spells' || presetCategory === 'all') && (
                    <div className="space-y-1.5 pt-1">
                      {presetCategory === 'all' && (
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-cyan-400 uppercase tracking-wider pt-1">
                          <Sparkles className="w-3 h-3" />
                          <span>Spells &amp; Magical Effects</span>
                        </div>
                      )}
                      {SPELL_RANGE_PRESETS.map((p) => {
                        const isActive = rangeLimit === p.range;

                        return (
                          <div
                            key={p.id}
                            className={`p-2 rounded-lg border transition-all text-xs ${
                              isActive
                                ? 'bg-cyan-950/40 border-cyan-500/60 shadow-sm'
                                : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 hover:bg-slate-950'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="px-1.5 py-0.5 rounded font-mono font-bold text-[11px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                  {p.rangeLabel}
                                </span>
                                <span className="font-semibold text-slate-200 text-[11px]">
                                  {p.classification}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleSelectPresetRange(p.range)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border transition-colors cursor-pointer ${
                                  isActive
                                    ? 'bg-cyan-400 text-slate-950 font-bold border-cyan-300 shadow-sm'
                                    : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-cyan-400/50 hover:text-cyan-200'
                                }`}
                              >
                                Select ({p.range}ft)
                              </button>
                            </div>

                            {/* Alphabetical list of spells */}
                            <div className="mt-1.5 flex flex-wrap gap-1 items-center">
                              <span className="text-[10px] text-slate-400 font-medium">Spells:</span>
                              {p.items.map((item) => (
                                <span
                                  key={item}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-slate-900/90 text-cyan-200/90 border border-slate-800 font-sans"
                                >
                                  {item}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary Card */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
              Calculated 3D Metrics
            </h3>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">True 3D Line of Sight</span>
                <span className="text-xl font-bold font-mono text-amber-300 tabular-nums">
                  {distanceResults.euclideanDistance} ft
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Euclidean hypotenuse</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Standard 5e (RAW)</span>
                <span className="text-xl font-bold font-mono text-cyan-300 tabular-nums">
                  {standard5eDist} ft
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">max(ground, height)</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Altitude Delta (ΔZ)</span>
                <span className="text-xl font-bold font-mono text-slate-200 tabular-nums">
                  {deltaElevation} ft
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Vertical displacement</span>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Trajectory Pitch</span>
                <span className="text-xl font-bold font-mono text-amber-400 tabular-nums">
                  {distanceResults.pitchAngleDegrees}°
                </span>
                <span className="text-[10px] text-slate-500 block mt-0.5">Elevation angle</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Visualizer Canvas & Reference Table */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
                  3D Triangulation Vector Diagram
                </h3>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                {isInRange ? '🟢 Line of Sight Clear' : '🔴 Out of Range'}
              </span>
            </div>

            <div className="bg-slate-950 rounded-xl border border-slate-800 overflow-hidden flex items-center justify-center p-2">
              <canvas
                ref={canvasRef}
                width={560}
                height={270}
                className="w-full max-w-full h-auto block"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Origin
                </span>
                <span className="flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full inline-block ${isInRange ? 'bg-emerald-500' : 'bg-red-500'}`} /> Target
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-sky-400 inline-block" /> Height (ΔZ)
                </span>
              </div>
              <span className="italic">Updates live with sliders</span>
            </div>
          </div>

          {/* Quick Pythagorean Altitude Reference Table (Expanded 500ft x 500ft Matrix) */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3 shadow-sm flex flex-col flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2">
                <Compass className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
                  3D Elevation &amp; Flying Distance Cheat Matrix (500ft × 500ft)
                </h3>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Click any cell to target • Active 3D: <strong className="text-amber-300">{distanceResults.euclideanDistance}ft</strong>
              </span>
            </div>

            <div className="overflow-auto max-h-[380px] rounded-lg border border-slate-800/80 bg-slate-950">
              <table className="w-full text-xs text-center border-collapse font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/95 sticky top-0 z-20 shadow-sm">
                    <th className="py-2 px-3 text-left font-bold text-slate-300 sticky left-0 bg-slate-900/95 z-30 border-r border-slate-800 whitespace-nowrap">
                      Height \ Ground
                    </th>
                    {CHEAT_TABLE_GROUND.map((g) => (
                      <th
                        key={g}
                        className={`py-2 px-2.5 font-bold whitespace-nowrap ${
                          g === closestGround ? 'text-amber-300 bg-amber-950/40' : 'text-slate-300'
                        }`}
                      >
                        {g} ft
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-slate-300">
                  {CHEAT_TABLE_HEIGHT.map((h) => {
                    const isRowClosest = h === closestHeight;
                    return (
                      <tr key={h} className={isRowClosest ? 'bg-slate-900/40' : 'hover:bg-slate-900/20'}>
                        <td
                          className={`py-1.5 px-3 text-left font-bold sticky left-0 z-10 border-r border-slate-800 whitespace-nowrap ${
                            isRowClosest ? 'text-cyan-300 bg-slate-900' : 'text-cyan-400/90 bg-slate-950'
                          }`}
                        >
                          {h} ft high
                        </td>
                        {CHEAT_TABLE_GROUND.map((g) => {
                          const dist = Math.round(Math.sqrt(g * g + h * h));
                          const isClosest = g === closestGround && h === closestHeight;
                          const isCellInRange = dist <= rangeLimit;

                          return (
                            <td
                              key={g}
                              onClick={() => {
                                setHorizontalDist(g);
                                setTargetElev(sourceElev + h);
                              }}
                              title={`Ground: ${g}ft, Height: ${h}ft -> 3D: ${dist}ft (${isCellInRange ? 'In Range' : 'Out of Range'})\nClick to set position`}
                              className={`py-1.5 px-2 transition-all cursor-pointer select-none text-[11px] tabular-nums ${
                                isClosest
                                  ? 'bg-amber-400 text-slate-950 font-bold ring-2 ring-amber-300 shadow-sm'
                                  : isCellInRange
                                  ? 'text-emerald-300/90 hover:bg-emerald-950/50 hover:text-emerald-200'
                                  : 'text-rose-300/80 hover:bg-rose-950/50 hover:text-rose-200'
                              }`}
                            >
                              {dist}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800/60 font-mono">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-emerald-500/20 border border-emerald-500/40 inline-block" /> In Range (≤{rangeLimit}ft)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-rose-500/20 border border-rose-500/40 inline-block" /> Out of Range
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded bg-amber-400 inline-block" /> Active Position
                </span>
              </div>
              <span>Pythagorean Formula: d = √(g² + h²)</span>
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
