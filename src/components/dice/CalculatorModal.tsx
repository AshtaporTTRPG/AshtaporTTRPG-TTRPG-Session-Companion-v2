import React, { useState, useEffect, useRef } from 'react';
import { Calculator, X, CornerDownLeft } from 'lucide-react';

export interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (appliedValue: string | number) => void;
}

/**
 * Safely evaluates basic arithmetic string expressions (+, -, *, /)
 */
function evaluateArithmetic(expr: string): number | null {
  const sanitized = expr.replace(/[^0-9+\-*/.]/g, '');
  if (!sanitized) return null;
  // Strip trailing operators before evaluation
  const trimmed = sanitized.replace(/[+\-*/.]+$/, '');
  if (!trimmed) return null;

  try {
    const res = new Function(`return (${trimmed})`)();
    if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
      return Math.round(res * 100) / 100;
    }
  } catch {}
  return null;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [equation, setEquation] = useState<string>('');
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close triggers: Escape key & clicking outside the docked popover
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentResult = evaluateArithmetic(equation);
  const formattedResult =
    currentResult !== null
      ? currentResult >= 0
        ? `+${currentResult}`
        : `${currentResult}`
      : '+0';

  const handleKeyClick = (key: string) => {
    if (key === 'C') {
      setEquation('');
    } else if (key === '=') {
      if (currentResult !== null) {
        setEquation(currentResult.toString());
      }
    } else {
      setEquation((prev) => prev + key);
    }
  };

  const handleApply = () => {
    if (currentResult !== null) {
      onApply(currentResult);
      onClose();
    }
  };

  const KEYPAD_BUTTONS = [
    ['7', '8', '9', '/'],
    ['4', '5', '6', '*'],
    ['1', '2', '3', '-'],
    ['C', '0', '=', '+'],
  ];

  return (
    <div
      ref={popoverRef}
      className="absolute top-full mt-1.5 left-0 z-50 w-64 bg-slate-950/95 border border-slate-800 rounded-xl shadow-2xl p-3 flex flex-col gap-2 backdrop-blur-md animate-fadeIn select-none text-xs font-mono"
      role="dialog"
      aria-label="Docked Dice Math Calculator"
      onClick={(e) => e.stopPropagation()}
    >
      {/* 1. Popover Header */}
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold font-sans text-xs">
          <Calculator className="w-3.5 h-3.5" />
          <span>Quick Calculator</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          title="Close (Esc)"
          aria-label="Close Calculator"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Display Screen (Active Equation & Real-time Result) */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-right">
        <div className="text-[11px] text-slate-400 min-h-[16px] truncate">
          {equation || '0'}
        </div>
        <div className="text-base font-bold text-amber-300 tabular-nums">
          {currentResult !== null ? `${equation ? `${equation} = ` : ''}${currentResult}` : '—'}
        </div>
      </div>

      {/* 3. Clean Keypad Grid: 7,8,9,/ | 4,5,6,* | 1,2,3,- | C,0,=,+ */}
      <div className="grid grid-cols-4 gap-1">
        {KEYPAD_BUTTONS.map((row, rIdx) =>
          row.map((btn) => {
            const isOp = ['/', '*', '-', '+'].includes(btn);
            const isEquals = btn === '=';
            const isClear = btn === 'C';

            return (
              <button
                key={`${rIdx}-${btn}`}
                type="button"
                onClick={() => handleKeyClick(btn)}
                className={`h-8 rounded-lg flex items-center justify-center font-bold text-xs transition cursor-pointer active:scale-95 ${
                  isClear
                    ? 'bg-rose-950/70 hover:bg-rose-900 border border-rose-800/80 text-rose-300'
                    : isEquals
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-sm'
                    : isOp
                    ? 'bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-400'
                    : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200'
                }`}
              >
                {btn}
              </button>
            );
          })
        )}
      </div>

      {/* 4. Action: Apply Result to Formula */}
      <button
        type="button"
        onClick={handleApply}
        disabled={currentResult === null}
        className="w-full py-2 px-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer font-sans active:scale-95"
        title="Append calculated result directly to formula input"
      >
        <CornerDownLeft className="w-3.5 h-3.5" />
        <span>➔ Apply to Formula ({formattedResult})</span>
      </button>
    </div>
  );
};

export default CalculatorModal;
