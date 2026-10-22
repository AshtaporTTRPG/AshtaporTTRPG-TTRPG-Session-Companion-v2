export interface WhiteboardCombatant {
  id: string;
  name: string;
  initiative: number;
  color: string;
  conditions: string[];
  note?: string;
  isDowned?: boolean;
}

export interface WhiteboardState {
  round: number;
  activeIndex: number;
  combatants: WhiteboardCombatant[];
}