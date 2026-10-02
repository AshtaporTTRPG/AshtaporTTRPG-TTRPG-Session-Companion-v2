import { CustomMacro, RollTypeCategory } from '../types/ttrpg';

const MACRO_STORAGE_KEY = 'ttrpg_custom_macros';

export const DEFAULT_STARTER_MACROS: CustomMacro[] = [
  { id: 'm-1', name: 'Attack (Longsword)', formula: '1d20+5', rollType: 'Attack roll', advantageMode: 'normal', modifier: 5 },
  { id: 'm-2', name: 'Damage (Longsword)', formula: '1d8+3', rollType: 'Damage', advantageMode: 'normal', modifier: 0 },
  { id: 'm-3', name: 'Sneak Attack', formula: '3d6', rollType: 'Damage', advantageMode: 'normal', modifier: 0 },
  { id: 'm-4', name: 'Fireball', formula: '8d6', rollType: 'Damage', advantageMode: 'normal', modifier: 0 },
  { id: 'm-5', name: 'Perception Check', formula: '1d20+3', rollType: 'Skill check', advantageMode: 'normal', modifier: 3 },
  { id: 'm-6', name: 'Fate Die', formula: '1d20', rollType: 'Fate', advantageMode: 'normal', modifier: 0 },
];

/**
 * Loads custom player macros from localStorage.
 * If never set before, seeds with starter macros and saves them.
 * If user explicitly cleared or has saved macros, returns their saved state.
 */
export function loadCustomMacros(): CustomMacro[] {
  try {
    const raw = localStorage.getItem(MACRO_STORAGE_KEY);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to load custom macros from localStorage:', err);
  }

  // First time initialization: seed with defaults
  saveCustomMacros(DEFAULT_STARTER_MACROS);
  return DEFAULT_STARTER_MACROS;
}

/**
 * Persists custom player macros to localStorage across page reloads and future sessions.
 */
export function saveCustomMacros(macros: CustomMacro[]): void {
  try {
    localStorage.setItem(MACRO_STORAGE_KEY, JSON.stringify(macros));
  } catch (err) {
    console.error('Failed to save custom macros to localStorage:', err);
  }
}

/**
 * Creates and appends a new custom macro.
 */
export function addCustomMacro(
  name: string,
  formula: string,
  advantageMode: 'normal' | 'advantage' | 'disadvantage' = 'normal',
  modifier: number = 0,
  rollType: RollTypeCategory = 'Straight roll'
): CustomMacro {
  const current = loadCustomMacros();
  const newMacro: CustomMacro = {
    id: `macro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    formula: formula.trim(),
    advantageMode,
    modifier,
    rollType,
  };
  const updated = [...current, newMacro];
  saveCustomMacros(updated);
  return newMacro;
}

/**
 * Updates an existing macro by ID.
 */
export function updateCustomMacro(
  id: string,
  updatedFields: Partial<Omit<CustomMacro, 'id'>>
): CustomMacro[] {
  const current = loadCustomMacros();
  const updated = current.map((m) => (m.id === id ? { ...m, ...updatedFields } : m));
  saveCustomMacros(updated);
  return updated;
}

/**
 * Deletes a macro by ID.
 */
export function deleteCustomMacro(id: string): CustomMacro[] {
  const current = loadCustomMacros();
  const updated = current.filter((m) => m.id !== id);
  saveCustomMacros(updated);
  return updated;
}

/**
 * Resets macros back to the default starter set.
 */
export function resetCustomMacrosToDefault(): CustomMacro[] {
  saveCustomMacros(DEFAULT_STARTER_MACROS);
  return DEFAULT_STARTER_MACROS;
}
