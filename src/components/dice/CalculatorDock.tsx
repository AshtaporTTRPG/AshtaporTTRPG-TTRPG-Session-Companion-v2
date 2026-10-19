/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calculator, X, CornerDownLeft, Delete } from 'lucide-react';

export interface CalculatorDockProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (appliedValue: string | number) => void;
}

export type CalculatorModalProps = CalculatorDockProps;

/**
 * Safely evaluates basic arithmetic string expressions (+, -, *, /, parentheses, decimals)
 */
function evaluateArithmetic(expr: string): number | null {
  const sanitized = expr.replace(/[^0-9+\-*/.()]/g, '');
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

export const CalculatorDock: React.FC<CalculatorDockProps> = ({
  isOpen,
  onClose,
  onApply,
}) => {
  const [equation, setEquation] = useState<string>('');

  const currentResult = evaluateArithmetic(equation);
  const formattedResult =
    currentResult !== null
      ? currentResult >= 0
        ? `+${currentResult}`
        : `${currentResult}`
      : '+0';

  const handleBackspace = () => {
    setEquation((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
  };

  const handleKeyClick = (key: string) => {
    if (key === 'C') {
      setEquation('');
    } else if (key === '=') {
      if (currentResult !== null) {
        setEquation(currentResult.toString());
      }
    } else if (key === 'backspace') {
      handleBackspace();
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

  // Keyboard listener: Backspace deletes trailing character, Escape collapses dock
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow user to escape from within text inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentResult !== null) {
          handleApply();
        }
      } else if ('0123456789+-*/.()'.includes(e.key)) {
        e.preventDefault();
        handleKeyClick(e.key);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setEquation('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, currentResult]);

  if (!isOpen) return null;

  const KEYPAD_BUTTONS = [
    ['C', '(', ')', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', 'backspace', '='],
  ];

  return (
    <div
      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2.5 my-2 shadow-inner transition-all select-none text-xs font-mono flex flex-col gap-2"
      role="region"
      aria-label="Inline Docked Math Calculator"
    >
      {/* 1. Header with Title and Close X */}
      <div className="flex items-center justify-between pb-1 border-b border-slate-800">
        <div className="flex items-center gap-1.5 text-amber-400 font-bold font-sans text-xs">
          <Calculator className="w-3.5 h-3.5" />
          <span>Quick Calculator</span>
          <span className="text-[10px] text-slate-500 font-normal font-mono">(Inline Dock)</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition cursor-pointer"
          title="Collapse Calculator (Esc)"
          aria-label="Collapse Calculator"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 2. Display Screen (Active Expression & Real-Time Evaluated Total) */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-2 text-right">
        <div className="text-[11px] text-slate-400 min-h-[16px] truncate font-mono">
          {equation || '0'}
        </div>
        <div className="text-base font-bold text-amber-300 tabular-nums font-mono">
          {currentResult !== null ? `${equation ? `${equation} = ` : ''}${currentResult}` : '—'}
        </div>
      </div>

      {/* 3. Keypad Grid */}
      <div className="grid grid-cols-4 gap-1">
        {KEYPAD_BUTTONS.map((row, rIdx) =>
          row.map((btn) => {
            const isOp = ['/', '*', '-', '+'].includes(btn);
            const isParen = ['(', ')'].includes(btn);
            const isEquals = btn === '=';
            const isClear = btn === 'C';
            const isBackspace = btn === 'backspace';

            if (isBackspace) {
              return (
                <button
                  key={`${rIdx}-${btn}`}
                  type="button"
                  onClick={handleBackspace}
                  className="h-8 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center justify-center font-bold text-xs transition cursor-pointer active:scale-95 border border-slate-700"
                  title="Backspace (⌫)"
                  aria-label="Backspace"
                >
                  <Delete className="w-3.5 h-3.5 inline" />
                </button>
              );
            }

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
                    : isParen
                    ? 'bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-bold'
                    : 'bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200'
                }`}
              >
                {btn}
              </button>
            );
          })
        )}
      </div>

      {/* 4. Action: Apply Calculated Result Directly to Staged Formula */}
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

export default CalculatorDock;
