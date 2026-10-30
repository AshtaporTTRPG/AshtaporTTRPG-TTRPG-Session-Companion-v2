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
  Pin,
  FileText,
  BookOpen,
  Ruler,
} from 'lucide-react';

interface ContextualHelpTooltipProps {
  isOpen: boolean;
  onClose: () => void;
  activeAppTab?: any;
  isGM?: boolean;
}

export const ContextualHelpTooltip: React.FC<ContextualHelpTooltipProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg max-h-[88vh] flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden text-slate-200">
        {/* HEADER */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-slate-800 bg-slate-950/80 shrink-0">
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

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 text-xs text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
          {/* 1. STICKY HUD NOTE */}
          <section className="space-y-1.5 border-b border-slate-800/80 pb-3">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Pin className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
              <span>Sticky HUD Note (Cross-Tab Glance)</span>
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
              <li>
                <strong>Pin to HUD:</strong> Click <strong>HUD Pin</strong> on any note card or reader view to lock that note into a slim 22px bar visible across Combat, Dice, Range, Grimoire, and Notes.
              </li>
              <li>
                <strong>Interactive Glance Drawer:</strong> Click the bar to expand your note. You can check off tasks (<code>- [ ]</code>) directly inside the drawer while running combat or rolling dice.
              </li>
              <li>
                <strong>Live Inline Editing:</strong> Click the <strong>Pencil (✏️)</strong> icon on the HUD bar to edit note text in place without switching back to the Notes tab. Changes sync automatically to your vaults.
              </li>
              <li>
                <strong>Private & Client-Side:</strong> HUD pins exist only on your screen and take up 0 room metadata.
              </li>
            </ul>
          </section>

          {/* 2. COMBAT WHITEBOARD */}
          <section className="space-y-1.5 border-b border-slate-800/80 pb-3">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Swords className="w-3.5 h-3.5 text-rose-400" />
              <span>Combat Whiteboard</span>
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
              <li>
                <strong>Turn Management (GM):</strong> Step through initiative with <strong>Next</strong> / <strong>Prev</strong>, sort by score (<strong>⇅</strong>), or drag cards (⠿) to manually order combatants.
              </li>
              <li>
                <strong>Adding Combatants (GM):</strong> Click <strong>+</strong> in the header to enter an initiative roll, name, and color tag.
              </li>
              <li>
                <strong>Player Permissions:</strong> Players can edit character names, type notes (e.g., AC or spell slots), and toggle conditions, but cannot delete or re-sort the roster.
              </li>
              <li>
                <strong>Conditions & Downed (💀):</strong> Click <strong>+ Tag</strong> to apply status effects. Marking a combatant defeated (💀) automatically skips them in turn order.
              </li>
            </ul>
          </section>

          {/* 3. DICE CHAMBER & CALCULATOR */}
          <section className="space-y-1.5 border-b border-slate-800/80 pb-3">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Dices className="w-3.5 h-3.5 text-cyan-400" />
              <span>Dice Chamber & Staging</span>
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
              <li>
                <strong>[ 🎲 ROLL SUM ] (Single Total):</strong> Adds all dice and flat modifiers into one grand number (damage rolls, pooled skill checks, or healing).
              </li>
              <li>
                <strong>[ 📊 ROLL INDIV ] (Separate Checks):</strong> Rolls each d20 separately with modifiers added to each die (multi-attacks or mob attacks).
              </li>
              <li>
                <strong>Calculator Dock:</strong> Click the calculator icon to run quick math and paste the output straight into your roll formula.
              </li>
            </ul>
          </section>

          {/* 4. NOTES & SANDBOX PREP */}
          <section className="space-y-1.5 border-b border-slate-800/80 pb-3">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              <span>Notes, Handouts & Broadcasts</span>
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
              <li>
                <strong>3 Vaults:</strong>
                <div className="pl-2 space-y-0.5 mt-0.5 text-slate-400">
                  <div>• <strong className="text-slate-200">My Notes:</strong> Private local scratchpad stored on your device.</div>
                  <div>• <strong className="text-slate-200">Table Notes:</strong> Collaborative cards synchronized across the table for all players.</div>
                  <div>• <strong className="text-slate-200">GM Notes:</strong> Secret GM vault. Click <strong>Broadcast</strong> to project any note across all player screens in real time.</div>
                </div>
              </li>
              <li>
                <strong>6 Sandbox Categories:</strong> Filter notes by <strong>General</strong>, <strong>NPC</strong>, <strong>Location</strong>, <strong>Loot</strong>, <strong>Encounters</strong>, or <strong>Leads</strong>.
              </li>
              <li>
                <strong>1-Click Prep Templates:</strong> When creating a note, choose <em>"📋 Insert Template..."</em> to instantly scaffold structured agendas, dossiers, dungeon waypoints, or encounter cards.
              </li>
              <li>
                <strong>Collapsible Markdown:</strong> Use <code>#</code> (H1), <code>##</code> (H2), and <code>###</code> (H3) to create collapsible headers. Use <code>- [ ]</code> to create clickable checkboxes.
              </li>
              <li>
                <strong>Vault Transfer:</strong> Use the <strong>Transfer</strong> button on any card to move or copy notes between My Notes, Table Notes, and GM Notes.
              </li>
            </ul>
          </section>

          {/* 5. GRIMOIRE */}
          <section className="space-y-1.5 border-b border-slate-800/80 pb-3">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
              <span>Grimoire (Homebrew Rules)</span>
            </h3>
            <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-300">
              <li>
                <strong>Quick Lookup:</strong> Instant, zero-fluff reference cards for Potions, Flanking, Massive Damage, Rest limits, and Universal Currency.
              </li>
              <li>
                <strong>Instant Search:</strong> Filter rules by keyword or click the category pills (<em>Combat, Movement, Rest, World</em>).
              </li>
              <li>
                <strong>Copy to Table:</strong> Click the copy icon on any rule card to copy the exact text to your clipboard.
              </li>
            </ul>
          </section>

          {/* 6. 3D RANGE */}
          <section className="space-y-1.5">
            <h3 className="font-bold text-amber-400 text-xs flex items-center gap-1.5 uppercase tracking-wide">
              <Ruler className="w-3.5 h-3.5 text-emerald-400" />
              <span>3D Range Calculator</span>
            </h3>
            <p className="text-[11px] text-slate-300 pl-4">
              Enter ground distance and elevation difference to calculate true Pythagorean distance for aerial combat, ranged attacks, and vertical spell ranges.
            </p>
          </section>
        </div>

        {/* FOOTER */}
        <div className="px-3.5 py-2 border-t border-slate-800 bg-slate-950/60 flex justify-end shrink-0">
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
