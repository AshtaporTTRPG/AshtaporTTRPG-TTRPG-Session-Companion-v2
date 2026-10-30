/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  X,
  HelpCircle,
  Swords,
  Dices,
  Ruler,
  BookOpen,
  FileText,
  Pin,
} from 'lucide-react';

interface ContextualHelpTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  activeAppTab?: string;
  isGM?: boolean;
}

export const ContextualHelpTooltip: React.FC<ContextualHelpTooltipProps> = ({
  isOpen,
  onClose,
  activeAppTab = 'combat',
}) => {
  if (!isOpen) return null;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-black/80 backdrop-blur-sm animate-fadeIn select-none">
      <div className="relative w-full max-w-lg max-h-[86vh] flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* HEADER BAR */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/90 shrink-0">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <h2 className="text-xs font-bold text-slate-100 tracking-wider uppercase font-display">
              Ashtapor Quick Guide
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Close Guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 1:1 QUICK-JUMP ANCHOR STRIP */}
        <div className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-950/70 border-b border-slate-800/80 overflow-x-auto shrink-0 scrollbar-none">
          <button
            type="button"
            onClick={() => scrollToSection('help-sec-combat')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition shrink-0 cursor-pointer flex items-center gap-1 ${
              activeAppTab === 'combat'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>⚔️</span>
            <span>Combat</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('help-sec-dice')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition shrink-0 cursor-pointer flex items-center gap-1 ${
              activeAppTab === 'dice'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>🎲</span>
            <span>Dice</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('help-sec-tactics')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition shrink-0 cursor-pointer flex items-center gap-1 ${
              activeAppTab === 'range' || activeAppTab === 'tactics'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>📐</span>
            <span>Tactics</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('help-sec-grimoire')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition shrink-0 cursor-pointer flex items-center gap-1 ${
              activeAppTab === 'grimoire'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>📖</span>
            <span>Grimoire</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('help-sec-notes')}
            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition shrink-0 cursor-pointer flex items-center gap-1 ${
              activeAppTab === 'notes'
                ? 'bg-amber-400 text-slate-950 font-bold shadow-sm'
                : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <span>📝</span>
            <span>Notes</span>
          </button>

          <button
            type="button"
            onClick={() => scrollToSection('help-sec-hud')}
            className="px-2 py-0.5 text-[10px] font-semibold rounded transition shrink-0 cursor-pointer flex items-center gap-1 bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700"
          >
            <span>📌</span>
            <span>HUD</span>
          </button>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
          {/* 1. COMBAT WHITEBOARD (TAB 1) */}
          <section id="help-sec-combat" className="space-y-1.5 border-b border-slate-800/80 pb-3.5">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Swords className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span>1. Combat Whiteboard</span>
            </h3>
            <div className="font-mono text-[10px] text-amber-300/90 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
              Initiative Roster · Drag Reorder (⠿) · Defeated (💀) skips active turn
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 pt-0.5">
              <li>
                <strong>Turn Management (GM):</strong> Step through combat turns with <strong>Next</strong> / <strong>Prev</strong>, sort by score (<strong>⇅</strong>), or drag cards (⠿) to manually order combatants.
              </li>
              <li>
                <strong>Adding Combatants (GM):</strong> Click <strong>+</strong> in the header to enter initiative, name, and role/color tag[cite: 2].
              </li>
              <li>
                <strong>Player Permissions:</strong> Players can edit character names, type personal notes (AC/slots), and toggle status conditions, but cannot delete cards or re-sort the roster[cite: 2].
              </li>
              <li>
                <strong>Defeated Skip:</strong> Marking a combatant defeated (💀) dims their card and automatically bypasses them during initiative stepping[cite: 2].
              </li>
            </ul>
          </section>

          {/* 2. DICE CHAMBER & STAGING (TAB 2) */}
          <section id="help-sec-dice" className="space-y-1.5 border-b border-slate-800/80 pb-3.5">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Dices className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>2. Dice Chamber & Staging</span>
            </h3>
            <div className="font-mono text-[10px] text-cyan-300/90 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
              Roll Sum (Pooled total) · Roll Indiv (Separate d20 checks) · Scratchpad Dock
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 pt-0.5">
              <li>
                <strong>[ 🎲 ROLL SUM ] (Single Total):</strong> Adds all dice and flat modifiers into one grand result for damage rolls, pooled checks, or healing[cite: 2].
              </li>
              <li>
                <strong>[ 📊 ROLL INDIV ] (Separate Checks):</strong> Rolls each d20 separately with modifiers added to each individual die for multi-attacks and mob checks[cite: 2].
              </li>
              <li>
                <strong>Calculator Dock:</strong> Click the calculator icon to run quick arithmetic and insert the output directly into your staging tray[cite: 2].
              </li>
            </ul>
          </section>

          {/* 3. TACTICS (TAB 3) */}
          <section id="help-sec-tactics" className="space-y-1.5 border-b border-slate-800/80 pb-3.5">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Ruler className="w-3.5 h-3.5 text-lime-400 shrink-0" />
              <span>3. Tactics (3D Range, Jump, Fall & Lift)</span>
            </h3>
            <div className="font-mono text-[10px] text-lime-300/90 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
              3D: √(H² + V²) · Jump: 5/10 + Mod · Fall: 0 ≤ 15ft, then 1/ft · Lift: 15 × STR × Size
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 pt-0.5">
              <li>
                <strong>3D Range:</strong> Enter Horizontal distance and Vertical elevation (+ Above / - Below) to solve true diagonal distance and view instant reach guidance (e.g., <em>Reachable with 60 ft range</em>).
              </li>
              <li>
                <strong>Jump Calculator:</strong> Enter STR/DEX modifiers to view both Standing (5 ft + Mod) and Running (10 ft + Mod) clearances side-by-side with zero checks required.
              </li>
              <li>
                <strong>Fall Damage:</strong> Enter fall distance to inspect both Normal falls (0 damage up to 15 ft, then 1 flat HP/ft) and Incapacitated falls (1 flat HP/ft from 0 ft).
              </li>
              <li>
                <strong>Lifting & Dragging:</strong> Enter STR score and size category (Med to Gargantuan) for maximum push, drag, and lift capacity (15 × STR × Size Multiplier).
              </li>
            </ul>
          </section>

          {/* 4. GRIMOIRE (TAB 4) */}
          <section id="help-sec-grimoire" className="space-y-1.5 border-b border-slate-800/80 pb-3.5">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>4. Grimoire (Homebrew Rules)</span>
            </h3>
            <div className="font-mono text-[10px] text-indigo-300/90 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
              Potions (Bonus) · Flanking (+1/+2/+3) · Massive (&gt;50% = Unstable) · Currency (1:25:100)
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 pt-0.5">
              <li>
                <strong>Quick Lookup:</strong> Instant reference cards for Potions, Flanking, Massive Damage, Long Rest limits, and Universal Currency[cite: 2].
              </li>
              <li>
                <strong>Instant Search:</strong> Filter rules by keyword or click category pills (<em>Combat, Movement, Rest, World</em>)[cite: 2].
              </li>
              <li>
                <strong>Copy to Table:</strong> Click the copy icon on any rule card to copy the exact text to your clipboard[cite: 2].
              </li>
            </ul>
          </section>

          {/* 5. NOTES & SANDBOX PREP (TAB 5) */}
          <section id="help-sec-notes" className="space-y-1.5 border-b border-slate-800/80 pb-3.5">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>5. Notes, Handouts & Broadcasts</span>
            </h3>
            <div className="font-mono text-[10px] text-amber-300/90 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
              3 Vaults (Personal, Table, GM) · 5 Handout Themes · Markdown # ## ### · Clickable - [ ]
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 pt-0.5">
              <li>
                <strong>3 Vaults:</strong>
                <div className="pl-2 space-y-0.5 mt-0.5 text-slate-400">
                  <div>• <strong className="text-slate-200">My Notes:</strong> Private scratchpad stored locally on your device[cite: 2].</div>
                  <div>• <strong className="text-slate-200">Table Notes:</strong> Collaborative cards synchronized across the table for all players[cite: 2].</div>
                  <div>• <strong className="text-slate-200">GM Notes:</strong> Secret GM vault. Click <strong>Broadcast</strong> to project any note across all screens in real time[cite: 2].</div>
                </div>
              </li>
              <li>
                <strong>6 Sandbox Categories:</strong> Filter notes by <strong>General</strong>, <strong>NPC</strong>, <strong>Location</strong>, <strong>Loot</strong>, <strong>Encounters</strong>, or <strong>Leads</strong>[cite: 2].
              </li>
              <li>
                <strong>1-Click Prep Templates:</strong> Choose <em>"📋 Insert Template..."</em> to scaffold structured agendas, dossiers, dungeon waypoints, or encounter cards[cite: 2].
              </li>
              <li>
                <strong>Interactive Markdown:</strong> Headers (<code>#</code>, <code>##</code>, <code>###</code>) are collapsible; checkboxes (<code>- [ ]</code>) are interactive and clickable directly in reader views[cite: 2].
              </li>
              <li>
                <strong>Vault Transfer:</strong> Use <strong>Transfer</strong> to move or copy notes between My Notes, Table Notes, and GM Notes[cite: 2].
              </li>
            </ul>
          </section>

          {/* 6. STICKY HUD NOTE (CROSS-TAB UTILITY) */}
          <section id="help-sec-hud" className="space-y-1.5">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" />
              <span>6. Sticky HUD Note (Cross-Tab Glance)</span>
            </h3>
            <div className="font-mono text-[10px] text-amber-300/90 bg-slate-950/80 px-2 py-1 rounded border border-slate-800/80">
              Cross-Tab Pin · Interactive Checkboxes · Live Inline Edit (✏️) · 0 Metadata
            </div>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300 pt-0.5">
              <li>
                <strong>Pin to HUD:</strong> Click <strong>HUD Pin</strong> on any note card to lock it into a slim drawer visible across Combat, Dice, Tactics, Grimoire, and Notes[cite: 2].
              </li>
              <li>
                <strong>Interactive Drawer:</strong> Click the bar to expand your pinned note. Tasks (<code>- [ ]</code>) can be checked off directly inside the drawer without leaving combat[cite: 2].
              </li>
              <li>
                <strong>Live Inline Editing:</strong> Click <strong>✏️</strong> on the HUD bar to edit note text directly in place; edits sync automatically to your underlying vault[cite: 2].
              </li>
              <li>
                <strong>Private & Local:</strong> Pinned notes live strictly on your client screen and consume 0 room metadata[cite: 2].
              </li>
            </ul>
          </section>
        </div>

        {/* FOOTER */}
        <div className="px-3.5 py-2 border-t border-slate-800 bg-slate-950/70 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export default ContextualHelpTooltip;
