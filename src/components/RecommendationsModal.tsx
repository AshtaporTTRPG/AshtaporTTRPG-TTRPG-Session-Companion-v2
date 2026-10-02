import React from 'react';
import {
  X,
  Sparkles,
  Zap,
  Map,
  Volume2,
  Users,
  Compass,
  Database,
  ArrowRight,
} from 'lucide-react';

interface RecommendationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab: (tab: 'combat' | 'dice' | 'geometry' | 'map' | 'notes') => void;
}

const IMPROVEMENT_AREAS = [
  {
    category: '1. Combat & Encounter Mechanics',
    icon: '⚔️',
    items: [
      {
        title: 'Encounter Difficulty & XP Budget Calculator',
        description: 'Auto-calculate Easy / Medium / Hard / Deadly challenge ratings dynamically based on party size and character levels (DMG rules).',
      },
      {
        title: 'SRD 5e Monster & Spell Compendium',
        description: 'Instant search over open-source 5e monsters, spells, and magic items with 1-click "Add to Encounter" or "Roll Attack".',
      },
      {
        title: 'Concentration Check Automator',
        description: 'When a caster takes damage, immediately flash a DC reminder: "Make a DC {max(10, damage/2)} Constitution saving throw".',
      },
    ],
  },
  {
    category: '2. Interactive Maps & Tactical Play',
    icon: '🗺️',
    items: [
      {
        title: 'Draggable Character & Monster Tokens',
        description: 'Allow players and DMs to drag circular tokens directly across the 5ft grid with movement range circles and reach overlays.',
      },
      {
        title: 'Dynamic Fog of War with Line of Sight',
        description: 'Darken unrevealed rooms on the tactical dungeon battlemap, with a brush tool for DMs to reveal corridors as players explore.',
      },
      {
        title: 'High-Res Map Layer Export & Preset Library',
        description: 'Bundle curated biome maps (Forest Ambush, Tavern Brawl, Desert Ruins, Ship Deck) and allow saving custom homebrew map layers.',
      },
    ],
  },
  {
    category: '3. Shared Multiplayer & Discord Integration',
    icon: '🎲',
    items: [
      {
        title: 'Discord Webhook Integration',
        description: 'Send critical hits, natural 20s, and DM announcements directly into your campaign Discord server via a simple webhook URL.',
      },
      {
        title: 'Native Owlbear Rodeo Tabletop Sync',
        description: 'Synchronize initiative, HP, and dice events directly with native OBR room metadata without external brokers.',
      },
      {
        title: 'Secret Whispers & Hidden Rolls',
        description: 'Allow the DM to privately send a secret skill check or hidden room description to a single player character.',
      },
    ],
  },
  {
    category: '4. Atmosphere & Immersion',
    icon: '🎵',
    items: [
      {
        title: 'Ambient Soundscape Generator',
        description: 'Built-in procedural background audio generator for cozy tavern fires, dungeon dripping water, howling cavern winds, and combat percussion.',
      },
      {
        title: 'Character Sheet JSON Import',
        description: 'Import characters directly from standard JSON (or D&D Beyond format) to populate attacks, stats, saving throws, and spells.',
      },
    ],
  },
];

export const RecommendationsModal: React.FC<RecommendationsModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-400/10 border border-amber-400/30 text-amber-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-amber-300 font-display">
                Companion Improvement Roadmap
              </h2>
              <p className="text-xs text-slate-400">
                Actionable architectural recommendations to transform your session companion into a world-class VTT
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-600/30 text-xs text-amber-200/90 leading-relaxed">
            <strong>Current State:</strong> We have successfully implemented and unified all your core systems in this app:
            quick initiative, HP and condition tracking, room-shared dice rolling, 3D geometry & spell calculators, pan/zoom homebrew pin maps, and scratchpad notes.
            Below is the curated roadmap of high-impact features to add next to take it to the next level.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {IMPROVEMENT_AREAS.map((area) => (
              <div
                key={area.category}
                className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-3"
              >
                <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2">
                  <span className="text-lg">{area.icon}</span>
                  <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider font-display">
                    {area.category}
                  </h3>
                </div>

                <div className="space-y-3">
                  {area.items.map((item) => (
                    <div key={item.title} className="space-y-1">
                      <div className="text-xs font-semibold text-amber-300/90 flex items-center gap-1.5">
                        <ArrowRight className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{item.title}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal pl-4.5">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            All current systems are active and ready to play in the app!
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-lg cursor-pointer transition-colors"
          >
            Explore Companion
          </button>
        </div>
      </div>
    </div>
  );
};
