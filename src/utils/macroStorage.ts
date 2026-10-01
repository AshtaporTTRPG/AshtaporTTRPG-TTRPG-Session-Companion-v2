import { CustomMacro, RollTypeCategory } from '../types/ttrpg';

const MACRO_STORAGE_KEY = 'ttrpg_custom_macros';

export const DEFAULT_STARTER_MACROS: CustomMacro[] = [
  { id: 'm-1', name: 'Attack (Longsword)', formula: '1d20+5', rollType: 'Attack roll' },
  { id: 'm-2', name: 'Damage (Longsword)', formula: '1d8+3', rollType: 'Damage' },
  { id: 'm-3', name: 'Sneak Attack', formula: '3d6', rollType: 'Damage' },
  { id: 'm-4', name: 'Fireball', formula: '8d6', rollType: 'Damage' },
  { id: 'm-5', name: 'Perception Check', formula: '1d20+3', rollType: 'Skill check' },
  { id: 'm-6', name: 'Fate Die', formula: '1d20', rollType: 'Fate' },
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
  rollType: RollTypeCategory = 'Straight roll'
): CustomMacro {
  const current = loadCustomMacros();
  const newMacro: CustomMacro = {
    id: `macro-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    name: name.trim(),
    formula: formula.trim(),
    rollType,
  };
  const updated = [...current, newMacro];
  saveCustomMacros(updated);
  return newMacro;
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
