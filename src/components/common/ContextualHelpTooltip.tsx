import React from 'react';
import { X, HelpCircle } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="relative w-full max-w-md max-h-[85vh] flex flex-col bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-slate-100 tracking-wide uppercase">
              Ashtapor Companion Guide
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CONTENT BODY */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs text-slate-300 leading-relaxed scrollbar-thin scrollbar-thumb-slate-800">
          {/* COMBAT WHITEBOARD */}
          <section className="space-y-1.5 border-b border-slate-800/80 pb-3.5">
            <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
              <span>⚔️</span> Combat Whiteboard
            </h3>
            <p>
              A collaborative, real-time board for tracking initiative and battle conditions:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-300">
              <li>
                <strong>Adding Entries (GM Only):</strong> Click the <strong>+</strong> button in the top header cassette bar to expand a compact creation strip. Enter initiative, name, choose a color dot, and confirm.
              </li>
              <li>
                <strong>Player Editing Rules:</strong> Players can edit character names and notes (buffered scratchpad saving on blur or Enter) and toggle condition tags, but cannot add, sort, duplicate, or delete combatants.
              </li>
              <li>
                <strong>GM Controls:</strong> Only the GM can add entries, step through turns (<strong>Next</strong> / <strong>Prev</strong>), rewind to Round 1, sort by initiative (<strong>Sort ⇅</strong>), duplicate combatants, or drag cards (⠿) to manually adjust order.
              </li>
              <li>
                <strong>Color Markers:</strong> Click any circular swatch to pick any color on the wheel to identify players, monsters, or allies.
              </li>
              <li>
                <strong>Conditions & Notes:</strong> Click <strong>+ Tag</strong> to apply effects (Concentrating, Prone, Bless), or type inline notes (e.g. AC 15).
              </li>
              <li>
                <strong>Downed (💀):</strong> Mark defeated combatants to dim their tile. The turn tracker will automatically skip over them during battle.
              </li>
            </ul>
          </section>

          {/* DICE & CALCULATOR */}
          <section className="space-y-1.5 border-b border-slate-800/80 pb-3.5">
            <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
              <span>🎲</span> Dice & Staging
            </h3>
            <p>
              Build your formula using the dice chips, then choose your roll type:
            </p>
            <ul className="list-disc pl-4 space-y-1 text-slate-300">
              <li>
                <strong>[ 🎲 ROLL SUM ] (Single Combined Total):</strong> Adds all dice and flat modifiers into one grand number.
                <br />
                <span className="text-amber-300/90 font-medium">Use for:</span> Skill Challenges (pooling d20s toward a DC total), spell damage (e.g. 8d6), or healing pools.
              </li>
              <li>
                <strong>[ 📊 ROLL INDIV ] (Separate Attacks):</strong> Rolls each d20 separately and applies flat modifiers to each check.
                <br />
                <span className="text-amber-300/90 font-medium">Use for:</span> Multiple weapon attacks or monster mob turns (e.g. 4d20 + 3 rolls 4 distinct attacks).
              </li>
              <li>
                <strong>Calculator Dock:</strong> Click the calculator icon in the formula bar for quick arithmetic. Click <strong>Apply</strong> to insert the result straight into your roll formula.
              </li>
            </ul>
          </section>

          {/* NOTES & BROADCASTS */}
          <section className="space-y-1.5">
            <h3 className="font-bold text-amber-400 text-sm flex items-center gap-1.5">
              <span>📝</span> Notes, Handouts & Broadcasts
            </h3>
            <ul className="list-disc pl-4 space-y-1.5 text-slate-300">
              <li>
                <strong>My Notes (Private):</strong> Your personal offline scratchpad stored locally on your device for secret goals, inventory, and player reminders.
              </li>
              <li>
                <strong>Table Notes (Real-Time Sync):</strong> Shared tabletop notes synchronized instantly across all connected player and GM windows via Owlbear Rodeo room metadata (<code>ashtapor/table_notes</code>). Notes persist across page reloads and incognito sessions so no notes disappear.
              </li>
              <li>
                <strong>Handout Themes (All Players & GM):</strong> Choose from 5 distinct visual presentation styles:
                <div className="grid grid-cols-1 gap-1 my-1 pl-2 text-[11px] text-slate-300">
                  <div>• <strong className="text-slate-200">Slate:</strong> Clean, high-contrast dark stone for tactical session logs.</div>
                  <div>• <strong className="text-amber-200">Parchment:</strong> Weathered historic manuscript with classic serif font for letters and lore.</div>
                  <div>• <strong className="text-zinc-200">Tablet:</strong> Chiseled monospaced slate with uppercase tracking for ancient ruins and runes.</div>
                  <div>• <strong className="text-indigo-300">Scroll:</strong> Mystical deep indigo parchment with arcane glow for magical spells and decrees.</div>
                  <div>• <strong className="text-amber-300">Journal:</strong> Warm leather-bound antique tome with serif typography for character diaries.</div>
                </div>
              </li>
              <li>
                <strong>Interactive In-Card Checklists:</strong> Use <code>- [ ]</code> syntax to create checklists. Players and GMs can tap checkboxes directly inside note cards to check off quest objectives, clues, and loot distribution on the fly.
              </li>
              <li>
                <strong>GM Notes & Table Broadcasts (((o))):</strong> Secret GM campaign vault. Click the broadcast radio icon (<strong>((o))</strong>) on any GM note to project it across every player's screen in its styled handout theme. The GM has a dedicated 1-click "Stop Revealing & Close" control to dismiss the broadcast for everyone.
              </li>
              <li>
                <strong>Vault Transfers:</strong> Effortlessly copy or move notes between My Notes, Table Notes, and GM Notes using the Transfer menu.
              </li>
            </ul>
          </section>
        </div>

        {/* MODAL FOOTER */}
        <div className="px-4 py-2.5 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};