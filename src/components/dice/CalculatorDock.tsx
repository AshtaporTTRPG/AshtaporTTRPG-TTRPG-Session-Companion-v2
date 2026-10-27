/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Calculator,
  Maximize2,
  Minimize2,
  X,
  Delete,
} from 'lucide-react';

export type CalcViewMode = 'docked' | 'expanded' | 'closed';

export interface CalculatorDockProps {
  viewMode?: CalcViewMode;
  onChangeViewMode?: (mode: CalcViewMode) => void;
  isOpen?: boolean;
  onClose?: () => void;
  onApply: (valOrStr: string | number) => void;
}

/**
 * Safe arithmetic evaluator that parses basic math without eval()
 * Handles +, -, *, /, decimals, and parentheses with proper precedence.
 */
function safeEvaluateMath(expr: string): number {
  if (!expr.trim()) return 0;
  const sanitized = expr.replace(/[^0-9+\-*/().]/g, '');
  if (!sanitized) return 0;

  const tokens: string[] = [];
  let i = 0;
  while (i < sanitized.length) {
    const ch = sanitized[i];
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')') {
      tokens.push(ch);
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let numStr = '';
      while (i < sanitized.length && /[0-9.]/.test(sanitized[i])) {
        numStr += sanitized[i];
        i++;
      }
      tokens.push(numStr);
    } else {
      i++;
    }
  }

  // Normalize unary minus (e.g. -5 + 10 or 10 * -2)
  const normalized: string[] = [];
  for (let j = 0; j < tokens.length; j++) {
    const t = tokens[j];
    if (t === '-' && (j === 0 || ['+', '-', '*', '/', '('].includes(tokens[j - 1]))) {
      if (j + 1 < tokens.length && !isNaN(Number(tokens[j + 1]))) {
        normalized.push(`-${tokens[j + 1]}`);
        j++;
      } else {
        normalized.push('0');
        normalized.push('-');
      }
    } else {
      normalized.push(t);
    }
  }

  // Shunting-Yard algorithm: convert to Reverse Polish Notation (RPN)
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  const outputQueue: string[] = [];
  const opStack: string[] = [];

  for (const token of normalized) {
    if (!isNaN(Number(token))) {
      outputQueue.push(token);
    } else if (token in precedence) {
      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1] in precedence &&
        precedence[opStack[opStack.length - 1]] >= precedence[token]
      ) {
        outputQueue.push(opStack.pop()!);
      }
      opStack.push(token);
    } else if (token === '(') {
      opStack.push(token);
    } else if (token === ')') {
      while (opStack.length > 0 && opStack[opStack.length - 1] !== '(') {
        outputQueue.push(opStack.pop()!);
      }
      opStack.pop();
    }
  }
  while (opStack.length > 0) {
    const op = opStack.pop()!;
    if (op !== '(' && op !== ')') outputQueue.push(op);
  }

  // Evaluate RPN
  const stack: number[] = [];
  for (const token of outputQueue) {
    if (!isNaN(Number(token))) {
      stack.push(Number(token));
    } else {
      const b = stack.pop() ?? 0;
      const a = stack.pop() ?? 0;
      switch (token) {
        case '+': stack.push(a + b); break;
        case '-': stack.push(a - b); break;
        case '*': stack.push(a * b); break;
        case '/': stack.push(b === 0 ? 0 : a / b); break;
      }
    }
  }

  const result = stack.pop() ?? 0;
  return isNaN(result) || !isFinite(result) ? 0 : Math.round(result * 100) / 100;
}

export const CalculatorDock: React.FC<CalculatorDockProps> = ({
  viewMode = 'docked',
  onChangeViewMode,
  onApply,
}) => {
  const [expression, setExpression] = useState<string>('');
  const isExpanded = viewMode === 'expanded';

  const evaluatedResult = safeEvaluateMath(expression);

  const toggleViewMode = () => {
    if (onChangeViewMode) {
      onChangeViewMode(isExpanded ? 'docked' : 'expanded');
    }
  };

  const handleKeypadPress = (val: string) => {
    if (val === 'C') {
      setExpression('');
    } else if (val === 'BACK') {
      setExpression((prev) => prev.slice(0, -1));
    } else if (val === '=') {
      setExpression(String(evaluatedResult));
    } else {
      setExpression((prev) => `${prev}${val}`);
    }
  };

  const handleApplyClick = () => {
    onApply(evaluatedResult);
  };

  return (
    <div className="bg-slate-900/90 border border-cyan-800/50 hover:border-cyan-700/60 rounded-xl p-2 shrink-0 space-y-1.5 shadow-sm transition-colors">
      {/* 1. DOCKED MINI MATH BAR */}
      <div className="flex items-center gap-1.5 h-7">
        {/* Leading Micro-Badge */}
        <div className="flex items-center gap-1 shrink-0 select-none">
          <Calculator className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400/90">
            Math:
          </span>
        </div>

        {/* Unified Math Expression Input */}
        <div className="relative flex-1 flex items-center min-w-0 h-full">
          <input
            type="text"
            value={expression}
            onChange={(e) => setExpression(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            placeholder="e.g. 15+4, 28/2"
            className="w-full h-7 px-2 pr-5 text-xs font-mono font-bold rounded-md bg-slate-950 border border-slate-700/80 text-cyan-200 focus:outline-none focus:border-cyan-400 transition placeholder:text-slate-600"
          />
          {expression && (
            <button
              type="button"
              onClick={() => setExpression('')}
              className="absolute right-1 p-0.5 text-slate-400 hover:text-cyan-300 rounded transition cursor-pointer"
              title="Clear math expression"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Live Result Badge */}
        <div className="flex items-center gap-0.5 shrink-0 px-1 font-mono text-xs tabular-nums">
          <span className="text-slate-500">=</span>
          <span className="font-bold text-cyan-300">{evaluatedResult}</span>
        </div>

        {/* Apply Button */}
        <button
          type="button"
          onClick={handleApplyClick}
          className="h-7 px-2 bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-slate-950 font-bold text-xs rounded-md shadow-sm transition-transform flex items-center gap-1 shrink-0 cursor-pointer"
          title="Inject modifier into dice formula bar"
        >
          <span>Apply</span>
          <span className="font-mono text-[10px] font-semibold opacity-90">
            ({evaluatedResult >= 0 ? `+${evaluatedResult}` : evaluatedResult})
          </span>
        </button>

        {/* Expand / Collapse Full Keypad Toggle */}
        <button
          type="button"
          onClick={toggleViewMode}
          className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800 transition cursor-pointer shrink-0"
          title={isExpanded ? 'Collapse to mini math bar' : 'Expand full calculator keypad'}
        >
          {isExpanded ? (
            <Minimize2 className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* 2. EXPANDED FULL NUMERIC KEYPAD */}
      {isExpanded && (
        <div className="pt-1.5 border-t border-slate-800 space-y-1.5 animate-fadeIn">
          {/* Keypad Display */}
          <div className="h-8 px-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between font-mono">
            <span className="text-xs text-slate-400 truncate max-w-[280px]">
              {expression || '0'}
            </span>
            <span className="text-sm font-bold text-cyan-300 tabular-nums">
              = {evaluatedResult}
            </span>
          </div>

          {/* Keypad Grid */}
          <div className="grid grid-cols-5 gap-1 text-xs font-mono">
            {/* Row 1 */}
            <button
              type="button"
              onClick={() => handleKeypadPress('7')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              7
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('8')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              8
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('9')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              9
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('/')}
              className="h-8 rounded bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 text-cyan-300 font-bold transition active:scale-95 cursor-pointer"
            >
              /
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('C')}
              className="h-8 rounded bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800/70 text-rose-300 font-bold transition active:scale-95 cursor-pointer"
            >
              C
            </button>

            {/* Row 2 */}
            <button
              type="button"
              onClick={() => handleKeypadPress('4')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              4
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('5')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              5
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('6')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              6
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('*')}
              className="h-8 rounded bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 text-cyan-300 font-bold transition active:scale-95 cursor-pointer"
            >
              *
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('BACK')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-rose-400 font-bold flex items-center justify-center transition active:scale-95 cursor-pointer"
              title="Backspace"
            >
              <Delete className="w-3.5 h-3.5" />
            </button>

            {/* Row 3 & 4 */}
            <button
              type="button"
              onClick={() => handleKeypadPress('1')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              1
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('2')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              2
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('3')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              3
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('-')}
              className="h-8 rounded bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 text-cyan-300 font-bold transition active:scale-95 cursor-pointer"
            >
              -
            </button>

            {/* Spanning Apply Button in Grid */}
            <button
              type="button"
              onClick={handleApplyClick}
              className="row-span-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 active:scale-95 text-slate-950 font-bold text-xs p-1 shadow-md transition-transform flex flex-col items-center justify-center gap-0.5 cursor-pointer"
            >
              <span>➔ Apply</span>
              <span className="font-mono text-[10px] font-semibold opacity-90">
                ({evaluatedResult >= 0 ? `+${evaluatedResult}` : evaluatedResult})
              </span>
            </button>

            {/* Row 4 Bottom */}
            <button
              type="button"
              onClick={() => handleKeypadPress('0')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('.')}
              className="h-8 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold transition active:scale-95 cursor-pointer"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('=')}
              className="h-8 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition active:scale-95 cursor-pointer"
            >
              =
            </button>
            <button
              type="button"
              onClick={() => handleKeypadPress('+')}
              className="h-8 rounded bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/60 text-cyan-300 font-bold transition active:scale-95 cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalculatorDock;
