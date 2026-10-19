import React, { useState, useEffect } from 'react';
import { X, Delete, Calculator, Check, ArrowRight } from 'lucide-react';

interface MathCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (calculatedValue: number) => void;
}

export const MathCalculatorModal: React.FC<MathCalculatorModalProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [expr, setExpr] = useState<string>('');
  const [result, setResult] = useState<number | null>(null);
  const [evalError, setEvalError] = useState<string | null>(null);

  // Keyboard shortcut listener: Escape closes modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (result !== null) {
          onApply(result);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, result, onApply, onClose]);

  // Live evaluation of mathematical expression
  useEffect(() => {
    const trimmed = expr.trim();
    if (!trimmed) {
      setResult(null);
      setEvalError(null);
      return;
    }

    // Only allow numbers, math operators, parentheses, and dots
    const sanitized = trimmed.replace(/×/g, '*').replace(/÷/g, '/');
    if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
      setResult(null);
      setEvalError('Invalid characters');
      return;
    }

    try {
      // Safe arithmetic evaluator
      const fn = new Function(`"use strict"; return (${sanitized});`);
      const val = fn();
      if (typeof val === 'number' && !isNaN(val) && isFinite(val)) {
        setResult(Math.round(val * 1000) / 1000);
        setEvalError(null);
      } else {
        setResult(null);
        setEvalError('Invalid result');
      }
    } catch {
      // Expression incomplete while typing
      setResult(null);
      setEvalError(null);
    }
  }, [expr]);

  if (!isOpen) return null;

  const handleAppend = (char: string) => {
    setExpr((prev) => prev + char);
  };

  const handleClear = () => {
    setExpr('');
    setResult(null);
    setEvalError(null);
  };

  const handleBackspace = () => {
    setExpr((prev) => prev.slice(0, -1));
  };

  const handleApply = () => {
    if (result !== null) {
      onApply(result);
      onClose();
    }
  };

  return (
    <div
      className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 animate-fadeIn select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[280px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col p-3 gap-2.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1.5 border-b border-slate-800 text-xs">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <Calculator className="w-3.5 h-3.5" />
            <span>Math Calculator</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Display Screen */}
        <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800 flex flex-col items-end justify-between min-h-[58px]">
          <div className="text-xs font-mono text-slate-400 truncate max-w-full">
            {expr || '0'}
          </div>
          <div className="text-lg font-mono font-black text-amber-400 tracking-tight">
            {result !== null ? `= ${result}` : evalError ? <span className="text-xs text-rose-400 font-sans">{evalError}</span> : '= 0'}
          </div>
        </div>

        {/* Keypad Grid (4 columns) */}
        <div className="grid grid-cols-4 gap-1 text-xs font-mono font-bold">
          {/* Row 1 */}
          <button
            type="button"
            onClick={handleClear}
            className="h-8 rounded-lg bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-800/50 transition cursor-pointer flex items-center justify-center font-sans font-bold"
            title="Clear all"
          >
            C
          </button>
          <button
            type="button"
            onClick={() => handleAppend('(')}
            className="h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
          >
            (
          </button>
          <button
            type="button"
            onClick={() => handleAppend(')')}
            className="h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
          >
            )
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
            title="Backspace"
          >
            <Delete className="w-3.5 h-3.5" />
          </button>

          {/* Row 2 */}
          <button
            type="button"
            onClick={() => handleAppend('7')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            7
          </button>
          <button
            type="button"
            onClick={() => handleAppend('8')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            8
          </button>
          <button
            type="button"
            onClick={() => handleAppend('9')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            9
          </button>
          <button
            type="button"
            onClick={() => handleAppend(' / ')}
            className="h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
          >
            ÷
          </button>

          {/* Row 3 */}
          <button
            type="button"
            onClick={() => handleAppend('4')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            4
          </button>
          <button
            type="button"
            onClick={() => handleAppend('5')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            5
          </button>
          <button
            type="button"
            onClick={() => handleAppend('6')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            6
          </button>
          <button
            type="button"
            onClick={() => handleAppend(' * ')}
            className="h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
          >
            ×
          </button>

          {/* Row 4 */}
          <button
            type="button"
            onClick={() => handleAppend('1')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            1
          </button>
          <button
            type="button"
            onClick={() => handleAppend('2')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            2
          </button>
          <button
            type="button"
            onClick={() => handleAppend('3')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            3
          </button>
          <button
            type="button"
            onClick={() => handleAppend(' - ')}
            className="h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
          >
            −
          </button>

          {/* Row 5 */}
          <button
            type="button"
            onClick={() => handleAppend('0')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => handleAppend('.')}
            className="h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-100 transition cursor-pointer flex items-center justify-center"
          >
            .
          </button>
          <button
            type="button"
            onClick={() => {
              // Trigger final result calculation
              if (result !== null) {
                setExpr(String(result));
              }
            }}
            className="h-8 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 border border-amber-500/50 transition cursor-pointer flex items-center justify-center font-bold"
          >
            =
          </button>
          <button
            type="button"
            onClick={() => handleAppend(' + ')}
            className="h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700/80 transition cursor-pointer flex items-center justify-center"
          >
            +
          </button>
        </div>

        {/* Apply Action Button */}
        <button
          type="button"
          onClick={handleApply}
          disabled={result === null}
          className="w-full py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer shadow-md"
        >
          <ArrowRight className="w-3.5 h-3.5" />
          <span>Apply to Formula ({result !== null ? (result >= 0 ? `+${result}` : `${result}`) : '+0'})</span>
        </button>
      </div>
    </div>
  );
};
