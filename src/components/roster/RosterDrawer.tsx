/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MyRosterDrawer, MyRosterDrawerProps } from '../combat/MyRosterDrawer';

export type RosterDrawerProps = MyRosterDrawerProps;

export const RosterDrawer: React.FC<RosterDrawerProps> = (props) => {
  return <MyRosterDrawer {...props} />;
};

export default RosterDrawer;
