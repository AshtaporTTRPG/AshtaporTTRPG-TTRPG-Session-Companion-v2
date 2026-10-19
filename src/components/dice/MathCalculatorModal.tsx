import React from 'react';
import { CalculatorModal, CalculatorModalProps } from './CalculatorModal';

export type MathCalculatorModalProps = CalculatorModalProps;

export const MathCalculatorModal: React.FC<MathCalculatorModalProps> = (props) => {
  return <CalculatorModal {...props} />;
};

export default MathCalculatorModal;
