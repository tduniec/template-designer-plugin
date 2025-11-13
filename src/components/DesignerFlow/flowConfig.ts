import { Position } from "@xyflow/react";
import { ActionNode } from "../../nodes/ActionNode";
import { ParametersNode } from "../../nodes/ParametersNode";
import { OutputNode } from "../../nodes/OutputNode";

// Centralized flow layout + node type definitions consumed across DesignerFlow.

export const FLOW_LAYOUT = {
  verticalSpacing: 400,
  fixedXPosition: 100,
} as const;

export const nodeTypes = {
  parametersNode: ParametersNode,
  actionNode: ActionNode,
  outputNode: OutputNode,
};

export const nodeDefaults = {
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
};
