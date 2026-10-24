/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Radio, X, EyeOff, Copy, Check } from 'lucide-react';
import { BroadcastNotePayload, NOTE_THEME_CONFIG } from '../../types/notes';
import { copyToClipboard } from '../../utils/clipboard';
import { renderMarkdown } from '../../utils/markdownRenderer';

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

  const themeCfg = broadcastNote.theme
    ? NOTE_THEME_CONFIG[broadcastNote.theme] || NOTE_THEME_CONFIG.slate
    : NOTE_THEME_CONFIG.slate;

  return (
    <div className="absolute inset-0 z-50 bg-neutral-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
      <div
        className={`w-full max-w-sm rounded-2xl p-4 shadow-2xl space-y-3 border-2 ring-1 ring-amber-400/40 transition-colors ${themeCfg.cardClasses}`}
      >
        {/* Broadcast Banner Header */}
        <div className="flex items-center justify-between pb-2 border-b border-inherit/30">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div className="truncate flex-1 min-w-0">
              <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                Table Broadcast
              </span>
              <h3 className="text-xs font-bold truncate" title={broadcastNote.title}>
                {broadcastNote.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0 ml-1">
            {/* 1-Click Copy Message Button */}
            <button
              type="button"
              onClick={handleCopy}
              className="px-2 py-1 text-[11px] font-semibold rounded bg-black/30 hover:bg-black/50 text-inherit border border-white/20 hover:border-amber-400/50 flex items-center gap-1 transition cursor-pointer"
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
              className="opacity-70 hover:opacity-100 p-1 rounded-md hover:bg-white/10 transition cursor-pointer"
              title={isGM ? 'Stop Revealing & Close' : 'Dismiss'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Note Text Content with themed styles and markdown rendering */}
        <div
          className={`select-text cursor-text p-3 rounded-xl border text-xs leading-relaxed max-h-56 overflow-y-auto selection:bg-amber-500/30 selection:text-amber-200 ${themeCfg.contentClasses}`}
        >
          {renderMarkdown(broadcastNote.content)}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-1 border-t border-inherit/30">
          <span className="text-[10px] opacity-70 font-mono">
            {broadcastNote.author ? `Revealed by ${broadcastNote.author}` : 'Revealed by Game Master'}
          </span>

          <div className="flex items-center gap-2">
            {isGM ? (
              <button
                type="button"
                onClick={onStopRevealing || onCloseOrDismiss}
                className="bg-rose-700 hover:bg-rose-600 text-white font-bold text-xs px-3 py-1.5 rounded flex items-center gap-1.5 transition cursor-pointer shadow-sm"
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
