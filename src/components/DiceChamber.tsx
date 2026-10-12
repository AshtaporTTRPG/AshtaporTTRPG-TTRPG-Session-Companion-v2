import React from 'react';
import { DiceTab, DiceTabProps } from './dice/DiceTab';

export type DiceChamberProps = DiceTabProps;

export const DiceChamber: React.FC<DiceChamberProps> = (props) => {
  return <DiceTab {...props} />;
};

export default DiceChamber;
