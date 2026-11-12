import { CustomMacro, RollTypeCategory } from '../types/ttrpg';

const MACRO_STORAGE_KEY = 'ashtapor_macros_v2';
const LEGACY_STORAGE_KEY = 'ttrpg_custom_macros';

export const DEFAULT_STARTER_MACROS: CustomMacro[] = [
  { id: 'm-1', name: 'Attack (Longsword)', formula: '1d20+5', group: 'General', rollType: 'Attack roll', advantageMode: 'normal', modifier: 5 },
  { id: 'm-2', name: 'Damage (Longsword)', formula: '1d8+3', group: 'General', rollType: 'Damage', advantageMode: 'normal', modifier: 0 },
  { id: 'm-3', name: 'Sneak Attack', formula: '3d6', group: 'General', rollType: 'Damage', advantageMode: 'normal', modifier: 0 },
  { id: 'm-4', name: 'Fireball', formula: '8d6', group: 'General', rollType: 'Damage', advantageMode: 'normal', modifier: 0 },
  { id: 'm-5', name: 'Perception Check', formula: '1d20+3', group: 'General', rollType: 'Skill check', advantageMode: 'normal', modifier: 3 },
  { id: 'm-6', name: 'Fate Die', formula: '1d20', group: 'General', rollType: 'Fate', advantageMode: 'normal', modifier: 0 },
];

export function loadCustomMacros(): CustomMacro[] {
  try {
    const raw = localStorage.getItem(MACRO_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy !== null) {
      const parsed = JSON.parse(legacy);
      if (Array.isArray(parsed) && parsed.length > 0) {
        saveCustomMacros(parsed);
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load custom macros from localStorage:', err);
  }

  saveCustomMacros(DEFAULT_STARTER_MACROS);
  return DEFAULT_STARTER_MACROS;
}

export function saveCustomMacros(macros: CustomMacro[]): void {
  try {
    localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(macros));
  } catch (err) {
    console.error('Failed to save custom macros to localStorage:', err);
  }
}

export function addCustomMacro(
  name: string,
  formula?: string,
  advantageMode: 'normal' | 'advantage' | 'disadvantage' = 'normal',
  modifier: number = 0,
  rollType: RollTypeCategory = 'Straight roll',
  group?: string,
  secondaryFormula?: string,
  notes?: string
): CustomMacro {
  const current = loadCustomMacros();
  const cleanPrimary = formula?.trim() || undefined;
  const cleanSecondary = secondaryFormula?.trim() || undefined;
  const cleanGroup = group?.trim() || undefined;
  const cleanNotes = notes?.trim() || undefined;

  const newMacro: CustomMacro = {
    id: `macro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    formula: cleanPrimary,
    secondaryFormula: cleanSecondary,
    notes: cleanNotes,
    group: cleanGroup,
    advantageMode,
    modifier,
    rollType,
  };
  const updated = [...current, newMacro];
  saveCustomMacros(updated);
  return newMacro;
}

export function updateCustomMacro(
  id: string,
  updatedFields: Partial<Omit<CustomMacro, 'id'>>
): CustomMacro[] {
  const current = loadCustomMacros();
  const updated = current.map((m) => (m.id === id ? { ...m, ...updatedFields } : m));
  saveCustomMacros(updated);
  return updated;
}

export function duplicateCustomMacro(id: string): CustomMacro[] {
  const current = loadCustomMacros();
  const idx = current.findIndex((m) => m.id === id);
  if (idx === -1) return current;

  const source = current[idx];
  const clone: CustomMacro = {
    ...source,
    id: `macro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: `${source.name} (Copy)`,
  };

  const updated = [...current.slice(0, idx + 1), clone, ...current.slice(idx + 1)];
  saveCustomMacros(updated);
  return updated;
}

export function deleteCustomMacro(id: string): CustomMacro[] {
  const current = loadCustomMacros();
  const updated = current.filter((m) => m.id !== id);
  saveCustomMacros(updated);
  return updated;
}

export function resetCustomMacrosToDefault(): CustomMacro[] {
  saveCustomMacros(DEFAULT_STARTER_MACROS);
  return DEFAULT_STARTER_MACROS;
}
