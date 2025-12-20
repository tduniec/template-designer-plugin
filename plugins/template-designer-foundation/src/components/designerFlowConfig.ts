import { Position } from "@xyflow/react";

export const FLOW_LAYOUT = {
  verticalSpacing: 200,
  fixedXPosition: 100,
} as const;

export const nodeDefaults = {
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
};
