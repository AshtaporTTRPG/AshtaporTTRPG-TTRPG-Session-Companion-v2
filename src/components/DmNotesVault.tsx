import React, { useState, useMemo } from 'react';
import {
  Lock,
  Plus,
  Search,
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Radio,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { DmSecretNote, BroadcastNotePayload } from '../types/notes';

interface DmNotesVaultProps {
  dmNotes: DmSecretNote[];
  onSaveDmNote: (note: DmSecretNote) => void;
  onDeleteDmNote: (id: string) => void;
  onToggleReveal: (note: DmSecretNote) => void;
}

export const DmNotesVault: React.FC<DmNotesVaultProps> = ({
  dmNotes,
  onSaveDmNote,
  onDeleteDmNote,
  onToggleReveal,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedNotes, setCollapsedNotes] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('ashtapor_dm_notes_collapsed_v1');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {};
  });

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<DmSecretNote | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const toggleCollapse = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setCollapsedNotes((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem('ashtapor_dm_notes_collapsed_v1', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const activeRevealedNote = dmNotes.find((n) => n.isRevealed);

  const handleOpenCreate = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (note: DmSecretNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNote(note);
    setFormTitle(note.title);
    setFormContent(note.content);
    setIsEditorOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    if (editingNote) {
      const updated: DmSecretNote = {
        ...editingNote,
        title: formTitle.trim(),
        content: formContent.trim(),
        updatedAt: Date.now(),
      };
      onSaveDmNote(updated);
    } else {
      const created: DmSecretNote = {
        id: `dm-note-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: formTitle.trim(),
        content: formContent.trim(),
        isRevealed: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      onSaveDmNote(created);
    }

    setIsEditorOpen(false);
    setEditingNote(null);
    setFormTitle('');
    setFormContent('');
  };

  const handleCopy = (note: DmSecretNote, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(`${note.title}\n\n${note.content}`);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return dmNotes;
    const q = searchQuery.toLowerCase().trim();
    return dmNotes.filter(
      (n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
    );
  }, [dmNotes, searchQuery]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* DM Vault Top Bar */}
      <div className="flex items-center justify-between p-2 bg-slate-900/90 border border-slate-800 rounded-xl shrink-0">
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <Lock className="w-4 h-4 text-rose-400 shrink-0" />
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-slate-100 font-display flex items-center gap-1.5">
              <span>Secret DM Vault</span>
              <span className="text-[10px] text-rose-400 font-sans font-semibold">
                (GM Only · {dmNotes.length} {dmNotes.length === 1 ? 'note' : 'notes'})
              </span>
            </h4>
            {/* Updated Header Copy per Requirement A.3 */}
            <p className="text-[10px] text-slate-400 truncate">
              Manage secret cards. Click 👁 to broadcast a note to player screens.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-2.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 transition cursor-pointer flex items-center gap-1 shadow-sm shrink-0"
        >
          <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>New Note</span>
        </button>
      </div>

      {/* Search Bar if multiple notes */}
      {dmNotes.length > 3 && (
        <div className="relative shrink-0">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search secret cards..."
            className="w-full pl-8 pr-7 py-1 text-xs rounded-lg bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Active Broadcast Announcement Banner */}
      {activeRevealedNote && (
        <div className="p-2 rounded-xl bg-amber-950/50 border border-amber-500/70 text-amber-200 text-xs flex items-center justify-between gap-2 shadow-sm shrink-0 animate-fadeIn">
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="w-4 h-4 text-amber-400 animate-pulse shrink-0" />
            <div className="truncate">
              <span className="font-bold text-slate-100">Live Table Broadcast: </span>
              <span className="text-amber-300 font-medium">"{activeRevealedNote.title}"</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onToggleReveal(activeRevealedNote)}
            className="px-2 py-0.5 text-[11px] font-bold rounded bg-amber-400 text-slate-950 hover:bg-amber-300 transition cursor-pointer shrink-0"
          >
            Hide
          </button>
        </div>
      )}

      {/* DM Note Card List */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-0.5">
        {filteredNotes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 space-y-2">
            <Lock className="w-8 h-8 opacity-30 text-rose-400" />
            <p className="text-xs font-medium text-slate-400">
              {searchQuery ? 'No matching secret notes found.' : 'No secret DM notes yet.'}
            </p>
            <p className="text-[11px] text-slate-500">
              Click "+ New Note" above to write encounter tactics, NPC statblocks, or riddles.
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const isCollapsed = !!collapsedNotes[note.id];
            const timeStr = new Date(note.updatedAt || note.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });

            return (
              <div
                key={note.id}
                className={`p-2.5 rounded-xl border transition flex flex-col gap-2 ${
                  note.isRevealed
                    ? 'bg-amber-950/30 border-amber-500/80 shadow-md ring-1 ring-amber-400/40'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Card Header Row: Accordion toggle, Lock icon, Title (flex-1 min-w-0 truncate), Actions */}
                <div className="flex items-center justify-between gap-2 min-w-0">
                  {/* Title Container flex-1 min-w-0 with truncate per Requirement A.4 */}
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    {/* Collapse/Expand Toggle button */}
                    <button
                      type="button"
                      onClick={(e) => toggleCollapse(note.id, e)}
                      className="w-5 h-5 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300 flex items-center justify-center shrink-0 transition cursor-pointer"
                      title={isCollapsed ? 'Expand note' : 'Collapse note'}
                      aria-label={isCollapsed ? 'Expand note' : 'Collapse note'}
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />

                    {/* Note Title */}
                    <h4
                      className="text-xs font-bold text-slate-100 font-display truncate flex-1 min-w-0 cursor-pointer hover:text-amber-300 transition"
                      title={note.title}
                      onClick={(e) => toggleCollapse(note.id, e)}
                    >
                      {note.title}
                    </h4>
                  </div>

                  {/* Header Actions: Compact Icon Reveal Toggle adjacent to Edit (pencil) & Delete (trash) per Requirement A.1 & A.2 */}
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Compact Icon Toggle: NO text pill! */}
                    <button
                      type="button"
                      onClick={() => onToggleReveal(note)}
                      aria-label={note.isRevealed ? 'Hide from Table' : 'Reveal to Table'}
                      title={
                        note.isRevealed
                          ? 'Hide from Table (currently broadcasting to all player screens)'
                          : 'Reveal to Table (broadcast this note to all player screens)'
                      }
                      className={`p-1.5 rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                        note.isRevealed
                          ? 'text-amber-400 bg-amber-950/70 border border-amber-500/80 ring-1 ring-amber-400/80 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                          : 'text-slate-500 hover:text-amber-400 hover:bg-slate-800 border border-slate-800 hover:border-amber-400/40 ring-0 hover:ring-1 hover:ring-amber-400/30'
                      }`}
                    >
                      {note.isRevealed ? (
                        <Eye className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                      )}
                    </button>

                    {/* Edit Button */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(note, e)}
                      aria-label="Edit note"
                      title="Edit note"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Delete secret note "${note.title}"?`)) {
                          onDeleteDmNote(note.id);
                        }
                      }}
                      aria-label="Delete note"
                      title="Delete note"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 border border-transparent hover:border-slate-700 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded State: Full text area */}
                {!isCollapsed && (
                  <div className="space-y-2 pt-1 border-t border-slate-800/80">
                    <div
                      onClick={(e) => handleOpenEdit(note, e)}
                      title="Click to edit full note"
                      className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/60 shadow-inner cursor-pointer hover:border-slate-700 transition"
                    >
                      {note.content}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono px-0.5">
                      <span>
                        {timeStr} · {note.content.length} chars
                      </span>

                      <div className="flex items-center gap-2">
                        {note.isRevealed ? (
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            <span>Broadcast Active</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Private to GM</span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => handleCopy(note, e)}
                          className="text-slate-400 hover:text-amber-300 flex items-center gap-1 transition"
                          title="Copy note text"
                        >
                          {copiedId === note.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Create / Edit DM Secret Note */}
      {isEditorOpen && (
        <div className="absolute inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 animate-fadeIn">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-4 shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="text-xs font-bold text-slate-100 font-display flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-400" />
                <span>{editingNote ? 'Edit Secret Note' : 'Create Secret DM Note'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-2.5 text-xs">
              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                  Note Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Crypt Ambush, Traitor in the Guard, Tomb Riddle"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 font-sans"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-300 block mb-1">
                  Secret Content / DM Details *
                </label>
                <textarea
                  rows={6}
                  placeholder="Secret triggers, DCs, monster statblocks, puzzle solutions, or lore you may reveal..."
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs rounded-xl bg-slate-950 border border-slate-700 text-slate-100 focus:outline-none focus:border-amber-400 resize-none leading-relaxed"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-500">
                  Can be broadcast to table anytime with 👁.
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsEditorOpen(false)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1 text-xs font-bold rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 shadow"
                  >
                    {editingNote ? 'Save Changes' : 'Save Note'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
