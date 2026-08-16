import type { ComponentType } from 'react';

/** A disposable Room design that receives all host data and commands through props. */
export type RoomDesign<DesignProps> = {
  id: string;
  label: string;
  /** True when the design renders its own contextual inspector. */
  ownsInspector?: boolean;
  View: ComponentType<DesignProps>;
};
