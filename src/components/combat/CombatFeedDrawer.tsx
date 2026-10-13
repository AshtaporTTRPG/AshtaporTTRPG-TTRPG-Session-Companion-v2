import React, { useRef, useEffect } from 'react';
import { UnifiedFeedItem } from '../../utils/liveFeedSync';
import { Radio, X, Trash2, Swords } from 'lucide-react';

export interface CombatFeedDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  feedItems: UnifiedFeedItem[];
  isDm: boolean;
  onClearFeed: () => void;
  rollerIdentity?: string;
}

export const CombatFeedDrawer: React.FC<CombatFeedDrawerProps> = ({
  isOpen,
  onClose,
  feedItems,
  isDm,
  onClearFeed,
  rollerIdentity,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll inside drawer when open or items change
  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [isOpen, feedItems.length]);

  if (!isOpen) return null;

  return (
    <>
      {/* Click-away backdrop overlay */}
      <div
        className="absolute inset-0 bg-black/40 z-30 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-Up Absolute Drawer */}
      <div className="absolute z-40 inset-x-0 bottom-10 h-72 bg-slate-950/95 border-t border-slate-800 backdrop-blur-md rounded-t-xl p-3 flex flex-col shadow-2xl animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800/80 shrink-0">
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
            <h3 className="text-xs font-bold font-display text-slate-200 uppercase tracking-wide">
              Combat Feed
            </h3>
            <span className="text-[10px] text-slate-500 font-mono">
              ({feedItems.length})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {feedItems.length > 0 && (
              <button
                type="button"
                onClick={onClearFeed}
                className="text-[10px] text-slate-400 hover:text-rose-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-800 hover:border-rose-900/60 transition cursor-pointer flex items-center gap-1 shadow-sm"
                title="Clear combat feed"
              >
                <Trash2 className="w-3 h-3 text-slate-400" />
                <span>Clear Feed</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
              title="Close Combat Feed"
              aria-label="Close Combat Feed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Feed List */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto space-y-1.5 py-2 pr-1 min-h-0 text-xs"
        >
          {feedItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500 text-[11px] italic">
              <Swords className="w-6 h-6 mb-1 opacity-30 text-amber-400" />
              <span>No combat events logged yet. Turns, damage, and conditions will appear here.</span>
            </div>
          ) : (
            feedItems.map((evt) => {
              // Hide secret DM items from player view
              if (!isDm && (evt.isSecret || evt.playerMessage === undefined)) {
                return null;
              }

              const time = new Date(evt.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              });

              const isSecret = evt.isSecretRoll || evt.rollDetails?.visibility === 'gm_only';
              const displayMsg = !isDm && evt.playerMessage ? evt.playerMessage : evt.message;
              const isDamage = displayMsg.includes('took');
              const isHeal = displayMsg.includes('healed');
              const isTurnAnnouncement = evt.type === 'turn' || displayMsg.includes('Round') || displayMsg.includes('turn!');

              let cardStyle = 'bg-slate-900/80 border-slate-800 text-slate-300';
              if (isDamage) {
                cardStyle = 'bg-rose-950/30 border-rose-800/50 text-rose-200';
              } else if (isHeal) {
                cardStyle = 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200';
              } else if (isTurnAnnouncement) {
                cardStyle = 'bg-amber-950/30 border-amber-800/50 text-amber-200';
              }

              return (
                <div
                  key={evt.id}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-2 shadow-sm transition-colors ${cardStyle}`}
                >
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {isTurnAnnouncement ? (
                      <span className="text-amber-400 text-xs shrink-0">⚔️</span>
                    ) : isDamage ? (
                      <span className="text-rose-400 text-xs shrink-0">💥</span>
                    ) : isHeal ? (
                      <span className="text-emerald-400 text-xs shrink-0">💚</span>
                    ) : (
                      <span className="text-slate-400 text-xs shrink-0">•</span>
                    )}
                    <span className="font-medium truncate flex-1" title={displayMsg}>
                      {displayMsg}
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 shrink-0">
                    {time}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default CombatFeedDrawer;
