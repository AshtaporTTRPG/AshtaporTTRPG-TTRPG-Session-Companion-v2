/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Calculator, X, Minus, Maximize2, Delete } from 'lucide-react';

export type CalcViewMode = 'expanded' | 'minimized' | 'closed';

export interface CalculatorDockProps {
  viewMode?: CalcViewMode;
  onChangeViewMode?: (mode: CalcViewMode) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onApply: (appliedValue: string | number) => void;
}

export type CalculatorModalProps = CalculatorDockProps;

/**
 * Safely evaluates basic arithmetic string expressions (+, -, *, /, decimals)
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
  viewMode,
  onChangeViewMode,
  isOpen = true,
  onClose,
  onApply,
}) => {
  const [internalMode, setInternalMode] = useState<CalcViewMode>(
    viewMode ?? (isOpen ? 'expanded' : 'closed')
  );
  const [equation, setEquation] = useState<string>('');

  // Sync internal mode if viewMode prop changes
  useEffect(() => {
    if (viewMode !== undefined) {
      setInternalMode(viewMode);
    }
  }, [viewMode]);

  const activeMode: CalcViewMode = viewMode ?? (isOpen ? internalMode : 'closed');

  const setViewMode = (mode: CalcViewMode) => {
    if (onChangeViewMode) {
      onChangeViewMode(mode);
    }
    setInternalMode(mode);
    if (mode === 'closed' && onClose) {
      onClose();
    }
  };

  const currentResult = evaluateArithmetic(equation);
  const displayResult = currentResult !== null ? currentResult : 0;
  const formattedApplyText = displayResult >= 0 ? `+${displayResult}` : `${displayResult}`;

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

  const handleApplyFormula = () => {
    if (currentResult !== null) {
      onApply(currentResult);
    } else if (equation === '' || equation === '0') {
      onApply(0);
    }
  };

  // Keyboard listener:
  // - Pressing Backspace removes last character in active calculation
  // - Pressing Escape collapses dock to closed
  useEffect(() => {
    if (activeMode === 'closed') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow user to escape from within text inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setViewMode('closed');
        }
        return;
      }

      if (e.key === 'Escape') {
        e.preventDefault();
        setViewMode('closed');
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleApplyFormula();
      } else if ('0123456789+-*/.'.includes(e.key)) {
        e.preventDefault();
        handleKeyClick(e.key);
      } else if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setEquation('');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, currentResult, equation]);

  if (activeMode === 'closed' || !isOpen) return null;

  // 3. Minimized Slim Strip (32px Total Height)
  if (activeMode === 'minimized') {
    return (
      <div
        className="flex items-center justify-between px-2.5 py-1 bg-slate-900/90 border border-slate-800 rounded-lg shadow-sm my-1.5 select-none shrink-0"
        role="region"
        aria-label="Minimized Calculator Toolbar"
      >
        <div className="flex items-center gap-2 text-xs font-mono">
          <Calculator className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-slate-300">Result:</span>
          <span className="font-bold text-amber-300">{currentResult !== null ? currentResult : 0}</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleApplyFormula}
            className="px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-bold rounded shadow-sm active:scale-95 cursor-pointer transition"
          >
            Apply (+{currentResult !== null ? currentResult : 0})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('expanded')}
            title="Expand Calculator"
            className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer transition"
          >
            <Maximize2 className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('closed')}
            title="Close"
            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 2. Expanded View (~185px Total Height)
  return (
    <div
      className="w-full bg-slate-900/90 border border-slate-800 rounded-xl p-2 my-1.5 shadow-inner transition-all select-none text-xs font-mono flex flex-col gap-1.5 shrink-0"
      role="region"
      aria-label="Inline Docked Math Calculator"
    >
      {/* Header Strip (24px) */}
      <div className="flex items-center justify-between h-6 pb-1 border-b border-slate-800">
        <span className="flex items-center gap-1.5 text-xs font-bold text-amber-400">
          <Calculator className="w-3.5 h-3.5" /> Calculator
        </span>
        <div className="text-[11px] font-mono text-slate-300 truncate max-w-[190px] text-center">
          {equation ? (currentResult !== null ? `${equation} = ${currentResult}` : equation) : ''}
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setViewMode('minimized')}
            title="Minimize to Toolbar"
            className="p-1 text-slate-400 hover:text-slate-200 cursor-pointer transition"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('closed')}
            title="Close Calculator"
            className="p-1 text-slate-400 hover:text-rose-400 cursor-pointer transition"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Display Screen (Compact read-out) */}
      <div className="h-7 px-2 text-right text-xs font-mono bg-slate-950 border border-slate-800 rounded text-amber-300 flex items-center justify-end tracking-wider">
        <span className="truncate">{equation || (currentResult !== null ? currentResult.toString() : '0')}</span>
      </div>

      {/* 5-Column Keypad Layout (h-7 buttons, 28px height) */}
      <div className="grid grid-cols-5 gap-1">
        {/* Row 1: 7, 8, 9, /, C */}
        <button
          type="button"
          onClick={() => handleKeyClick('7')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          7
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('8')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          8
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('9')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          9
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('/')}
          className="h-7 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-400 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          /
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('C')}
          className="h-7 bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-xs font-bold rounded border border-rose-800/80 transition active:scale-95 cursor-pointer flex items-center justify-center"
          title="Clear All (C)"
        >
          C
        </button>

        {/* Row 2: 4, 5, 6, *, ⌫ */}
        <button
          type="button"
          onClick={() => handleKeyClick('4')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          4
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('5')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          5
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('6')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          6
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('*')}
          className="h-7 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-400 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          *
        </button>
        <button
          type="button"
          onClick={handleBackspace}
          className="h-7 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded flex items-center justify-center border border-slate-700 transition active:scale-95 cursor-pointer"
          title="Backspace (⌫)"
        >
          <Delete className="w-3.5 h-3.5" />
        </button>

        {/* Row 3: 1, 2, 3, -, ➔ Apply (+XX) */}
        <button
          type="button"
          onClick={() => handleKeyClick('1')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          1
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('2')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          2
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('3')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          3
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('-')}
          className="h-7 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-400 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          -
        </button>
        <button
          type="button"
          onClick={handleApplyFormula}
          className="row-span-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-bold rounded flex flex-col items-center justify-center text-center leading-tight p-0.5 shadow-sm active:scale-95 transition-transform cursor-pointer"
          title="Append current result directly to formula input"
        >
          <span>➔ Apply</span>
          <span>({formattedApplyText})</span>
        </button>

        {/* Row 4: 0, ., =, + (5th slot occupied by row-span-2) */}
        <button
          type="button"
          onClick={() => handleKeyClick('0')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          0
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('.')}
          className="h-7 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          .
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('=')}
          className="h-7 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded shadow-sm transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          =
        </button>
        <button
          type="button"
          onClick={() => handleKeyClick('+')}
          className="h-7 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-800/50 text-amber-400 font-bold text-xs rounded transition active:scale-95 cursor-pointer flex items-center justify-center"
        >
          +
        </button>
      </div>
    </div>
  );
};

export default CalculatorDock;
