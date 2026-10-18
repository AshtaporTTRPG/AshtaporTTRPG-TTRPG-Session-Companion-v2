/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Radio, X, EyeOff, Copy, Check } from 'lucide-react';
import { BroadcastNotePayload } from '../../types/notes';
import { copyToClipboard } from '../../utils/clipboard';

export interface BroadcastModalProps {
  broadcastNote: BroadcastNotePayload;
  isGM: boolean;
  onCloseOrDismiss: () => void;
  onStopRevealing?: () => void;
}

export const BroadcastModal: React.FC<BroadcastModalProps> = ({
  broadcastNote,
  isGM,
  onCloseOrDismiss,
  onStopRevealing,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `${broadcastNote.title}\n\n${broadcastNote.content}`;
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <div className="absolute inset-0 z-50 bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div className="w-full max-w-sm bg-neutral-900 border-2 border-amber-500/80 rounded-2xl p-4 shadow-2xl space-y-3 ring-1 ring-amber-400/40">
        {/* Broadcast Banner Header */}
        <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="truncate flex-1 min-w-0">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                Table Broadcast
              </span>
              <h3 className="text-xs font-bold text-neutral-100 font-display truncate" title={broadcastNote.title}>
                {broadcastNote.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {/* 1-Click Copy Message Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-1 text-[11px] font-semibold rounded bg-neutral-800 hover:bg-neutral-700 text-amber-300 border border-neutral-700 hover:border-amber-400/50 flex items-center gap-1 transition cursor-pointer"
              title={copied ? 'Copied to clipboard!' : 'Copy broadcast message to clipboard'}
              aria-label="Copy broadcast message"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[10px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[10px]">Copy</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={isGM && onStopRevealing ? onStopRevealing : onCloseOrDismiss}
              className="text-neutral-400 hover:text-neutral-200 p-1 rounded-md hover:bg-neutral-800 transition cursor-pointer"
              title={isGM ? 'Stop Revealing & Close' : 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Note Text Content with native text selection */}
        <div className="select-text cursor-text p-3 rounded-xl bg-neutral-950/90 border border-neutral-800 text-xs text-neutral-200 font-sans leading-relaxed whitespace-pre-wrap max-h-56 overflow-y-auto selection:bg-amber-500/30 selection:text-amber-200">
          {broadcastNote.content}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-neutral-800/80">
          <span className="text-[10px] text-neutral-500 font-mono">
            Revealed by Game Master
          </span>

          <div className="flex items-center gap-2">
            {isGM ? (
              <button
                type="button"
                onClick={onStopRevealing || onCloseOrDismiss}
                className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition cursor-pointer"
              >
                <EyeOff className="w-3.5 h-3.5" /> Stop Revealing & Close
              </button>
            ) : (
              <button
                type="button"
                onClick={onCloseOrDismiss}
                className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-neutral-950 shadow transition cursor-pointer"
              >
                Dismiss / Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastModal;
