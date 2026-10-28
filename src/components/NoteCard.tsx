// Add inside CATEGORY_STYLES in NoteCard.tsx:
  Clue: {
    borderL: 'border-l-teal-500',
    badge: 'bg-teal-500/10 text-teal-400 border border-teal-500/30',
    text: 'text-teal-400',
    activePill: 'border-teal-500 bg-teal-950/40 text-teal-200 font-bold',
  },

// Add inside CATEGORY_PILL_ACTIVE_STYLES in NoteCard.tsx:
  Clue: CATEGORY_STYLES.Clue.activePill,
