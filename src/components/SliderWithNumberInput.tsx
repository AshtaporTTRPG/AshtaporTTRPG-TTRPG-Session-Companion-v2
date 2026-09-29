import React, { useState, useEffect, useCallback } from 'react';

export interface SliderWithNumberInputProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  helperText?: string;
  accentColor?: 'amber' | 'cyan' | 'rose' | 'emerald' | 'indigo';
  disabled?: boolean;
  quickPresets?: number[];
  ariaLabel?: string;
}

export const SliderWithNumberInput: React.FC<SliderWithNumberInputProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  step = 5,
  unit = 'ft',
  helperText,
  accentColor = 'amber',
  disabled = false,
  quickPresets,
  ariaLabel,
}) => {
  // Local string state to allow seamless backspacing, clearing, and typing without premature snapping
  const [inputValue, setInputValue] = useState<string>(value.toString());

  // Keep local string in sync whenever external value changes
  useEffect(() => {
    setInputValue(value.toString());
  }, [value]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const parsed = parseFloat(e.target.value);
      if (!isNaN(parsed)) {
        setInputValue(parsed.toString());
        onChange(parsed);
      }
    },
    [onChange]
  );

  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setInputValue(raw);

      if (raw.trim() !== '') {
        const parsed = parseFloat(raw);
        if (!isNaN(parsed)) {
          // Immediately update parent state while typing if within reasonable bounds
          // We clamp to [min, max] for the slider state, but keep text intact
          const clamped = Math.min(max, Math.max(min, parsed));
          onChange(clamped);
        }
      }
    },
    [max, min, onChange]
  );

  const handleBlur = useCallback(() => {
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed) || inputValue.trim() === '') {
      // Fallback to min
      setInputValue(min.toString());
      onChange(min);
    } else {
      const clamped = Math.min(max, Math.max(min, parsed));
      setInputValue(clamped.toString());
      onChange(clamped);
    }
  }, [inputValue, max, min, onChange]);

  // Color mappings
  const accentClasses = {
    amber: {
      accent: 'accent-amber-400',
      text: 'text-amber-300',
      borderFocus: 'focus:border-amber-400',
      presetActive: 'bg-amber-400 text-slate-950 font-bold border-amber-300',
    },
    cyan: {
      accent: 'accent-cyan-400',
      text: 'text-cyan-300',
      borderFocus: 'focus:border-cyan-400',
      presetActive: 'bg-cyan-400 text-slate-950 font-bold border-cyan-300',
    },
    rose: {
      accent: 'accent-rose-400',
      text: 'text-rose-300',
      borderFocus: 'focus:border-rose-400',
      presetActive: 'bg-rose-500 text-white font-bold border-rose-400',
    },
    emerald: {
      accent: 'accent-emerald-400',
      text: 'text-emerald-300',
      borderFocus: 'focus:border-emerald-400',
      presetActive: 'bg-emerald-500 text-white font-bold border-emerald-400',
    },
    indigo: {
      accent: 'accent-indigo-400',
      text: 'text-indigo-300',
      borderFocus: 'focus:border-indigo-400',
      presetActive: 'bg-indigo-400 text-slate-950 font-bold border-indigo-300',
    },
  }[accentColor];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div>
          <span className="font-semibold text-slate-300">{label}</span>
          {helperText && (
            <span className="text-[10px] text-slate-500 block">{helperText}</span>
          )}
        </div>

        {/* Synchronized Manual Numeric Input Box */}
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <input
              type="number"
              min={min}
              max={max}
              step={step}
              value={inputValue}
              onChange={handleTextChange}
              onBlur={handleBlur}
              disabled={disabled}
              aria-label={ariaLabel || label}
              className={`w-20 px-2 py-1 text-xs font-mono font-bold text-center rounded-lg bg-slate-950 border border-slate-700 ${accentClasses.text} ${accentClasses.borderFocus} focus:outline-none transition-colors`}
            />
          </div>
          {unit && (
            <span className="text-xs font-mono text-slate-500 pointer-events-none select-none">
              {unit}
            </span>
          )}
        </div>
      </div>

      {/* Synchronized Continuous/Step Range Slider */}
      <div className="space-y-1">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(max, Math.max(min, value))}
          onChange={handleSliderChange}
          disabled={disabled}
          aria-label={`${label} slider`}
          className={`w-full ${accentClasses.accent} cursor-pointer h-1.5 bg-slate-800 rounded-lg appearance-none transition-all`}
        />

        <div className="flex justify-between text-[10px] text-slate-500 font-mono">
          <span>{min} {unit}</span>
          <span>{Math.round((min + max) / 2)} {unit}</span>
          <span>{max} {unit}</span>
        </div>
      </div>

      {/* Optional Quick Milestones */}
      {quickPresets && quickPresets.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-0.5">
          {quickPresets.map((presetVal) => (
            <button
              key={presetVal}
              type="button"
              onClick={() => {
                setInputValue(presetVal.toString());
                onChange(presetVal);
              }}
              className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                value === presetVal
                  ? accentClasses.presetActive
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {presetVal}{unit}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
