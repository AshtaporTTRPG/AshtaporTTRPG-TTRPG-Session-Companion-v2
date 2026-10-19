import React, { useState, useEffect, useRef } from 'react';
import { Calculator, X, CornerDownLeft } from 'lucide-react';

interface CalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (appliedValue: string) => void;
}

/**
 * Evaluates basic arithmetic string safely (only numbers, +, -, *, /)
 */
function evaluateArithmetic(expr: string): number | null {
  const sanitized = expr.replace(/[^0-9+\-*/.]/g, '');
  if (!sanitized) return null;
  // Ensure expression doesn't end with operator before evaluating
  const trimmed = sanitized.replace(/[+\-*/]+$/, '');
  if (!trimmed) return null;

  try {
    // Safe evaluation using Function with only arithmetic tokens
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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
      onApply(formattedResult);
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
      ref={containerRef}
      className="absolute top-11 right-0 w-52 p-2 bg-slate-950/95 border border-slate-800 rounded-lg shadow-2xl z-50 text-xs font-mono animate-fadeIn select-none backdrop-blur-md"
      role="dialog"
      aria-label="Dice Math Calculator"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold font-sans text-[11px]">
          <Calculator className="w-3.5 h-3.5" />
          <span>Calculator</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-0.5 text-slate-400 hover:text-slate-200 transition cursor-pointer"
          title="Close (Esc)"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Screen Display */}
      <div className="bg-slate-900 border border-slate-800 rounded p-1.5 mb-2 text-right">
        <div className="text-[10px] text-slate-400 min-h-[14px] truncate">
          {equation || '0'}
        </div>
        <div className="text-sm font-bold text-amber-300 tabular-nums">
          {currentResult !== null ? `= ${currentResult}` : '—'}
        </div>
      </div>

      {/* Keypad Grid */}
      <div className="grid grid-cols-4 gap-1 mb-2">
        {KEYPAD_BUTTONS.map((row, rIdx) =>
          row.map((btn) => {
            const isOp = ['/', '*', '-', '+', '='].includes(btn);
            const isClear = btn === 'C';
            return (
              <button
                key={`${rIdx}-${btn}`}
                type="button"
                onClick={() => handleKeyClick(btn)}
                className={`h-7 rounded flex items-center justify-center font-bold text-xs transition cursor-pointer ${
                  isClear
                    ? 'bg-rose-950/80 hover:bg-rose-900 border border-rose-800/80 text-rose-300'
                    : isOp
                    ? 'bg-amber-950/50 hover:bg-amber-900/60 border border-amber-800/60 text-amber-400'
                    : 'bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200'
                }`}
              >
                {btn}
              </button>
            );
          })
        )}
      </div>

      {/* Action: Apply Result to Formula */}
      <button
        type="button"
        onClick={handleApply}
        disabled={currentResult === null}
        className="w-full py-1.5 px-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded transition flex items-center justify-center gap-1 shadow-sm disabled:opacity-40 cursor-pointer font-sans"
        title="Apply calculated result to dice formula"
      >
        <CornerDownLeft className="w-3 h-3" />
        <span>Apply to Formula ({formattedResult})</span>
      </button>
    </div>
  );
};

export default CalculatorModal;
