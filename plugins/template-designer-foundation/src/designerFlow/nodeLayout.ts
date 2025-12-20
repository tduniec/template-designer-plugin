import type { Node } from "@xyflow/react";
import type {
  ActionNodeData,
  OutputNodeData,
  ParametersNodeData,
} from "../types/flowNodes";
import { NODE_VERTICAL_SPACING } from "../types/flowNodes";

// Shared helpers for computing consistent node alignment/spacing in the flow.

const DEFAULT_NODE_HEIGHT = 320;
const MIN_VERTICAL_GAP = 16;

const parseNumericHeight = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const estimateParametersNodeHeight = (node: Node): number | null => {
  if (node.type !== "parametersNode") {
    return null;
  }
  const data = node.data as ParametersNodeData | undefined;
  if (!data) {
    return null;
  }

  const sections = data.sections ?? [];
  const PARAMETER_SHELL_HEIGHT = 300;
  const PARAMETER_CARD_BASE = 220;
  const SECTION_BASE = 180;
  const FIELD_HEIGHT = 86;

  if (!sections.length) {
    return PARAMETER_SHELL_HEIGHT + PARAMETER_CARD_BASE + SECTION_BASE;
  }

  const sectionsHeight = sections.reduce((total, section) => {
    const fieldCount = section.fields?.length ?? 0;
    return total + SECTION_BASE + Math.max(fieldCount, 1) * FIELD_HEIGHT;
  }, 0);

  return PARAMETER_SHELL_HEIGHT + PARAMETER_CARD_BASE + sectionsHeight;
};

const estimateActionNodeHeight = (node: Node): number | null => {
  if (node.type !== "actionNode") {
    return null;
  }
  const data = node.data as ActionNodeData | undefined;
  if (!data) {
    return null;
  }
  const inputsLength = Object.keys(data.step?.input ?? {}).length || 0;
  const INPUT_ROW_HEIGHT = 56;
  const BASE_HEIGHT = 420;
  return BASE_HEIGHT + inputsLength * INPUT_ROW_HEIGHT;
};

const estimateOutputNodeHeight = (node: Node): number | null => {
  if (node.type !== "outputNode") {
    return null;
  }
  const data = node.data as OutputNodeData | undefined;
  if (!data) {
    return null;
  }
  const linksLength = Array.isArray(data.output?.links)
    ? data.output.links.length
    : 0;
  const textLength = Array.isArray((data.output as any)?.text)
    ? (data.output as any).text.length
    : 0;
  const ITEM_HEIGHT = 56;
  const BASE_HEIGHT = 320;
  return BASE_HEIGHT + Math.max(linksLength + textLength, 1) * ITEM_HEIGHT;
};

const estimateHeightByType = (node: Node): number | null => {
  return (
    estimateParametersNodeHeight(node) ??
    estimateActionNodeHeight(node) ??
    estimateOutputNodeHeight(node)
  );
};

export const resolveNodeHeightForTracking = (node: Node): number | null => {
  const explicit = parseNumericHeight(node?.measured?.height);
  if (explicit !== null) {
    return explicit;
  }
  return estimateHeightByType(node);
};

export const alignNodes = (
  nodes: Node[],
  fixedXPosition: number,
  verticalSpacing: number
) => {
  const parametersNode = nodes.find((node) => node.type === "parametersNode");
  const actionNodes = nodes.filter((node) => node.type === "actionNode");
  const outputNode = nodes.find((node) => node.type === "outputNode");

  let nextY = 0;
  const aligned: Node[] = [];

  if (parametersNode) {
    aligned.push({
      ...parametersNode,
      position: { x: fixedXPosition, y: 0 },
    });
    const height =
      resolveNodeHeightForTracking(parametersNode) ??
      NODE_VERTICAL_SPACING.parametersNode ??
      DEFAULT_NODE_HEIGHT;
    nextY += height + verticalSpacing + MIN_VERTICAL_GAP;
  }

  actionNodes.forEach((node, _index) => {
    aligned.push({
      ...node,
      position: { x: fixedXPosition, y: nextY },
    });
    const height =
      resolveNodeHeightForTracking(node) ??
      NODE_VERTICAL_SPACING.actionNode ??
      DEFAULT_NODE_HEIGHT;
    nextY += height + verticalSpacing + MIN_VERTICAL_GAP;
  });

  if (outputNode) {
    aligned.push({
      ...outputNode,
      position: { x: fixedXPosition, y: nextY },
    });
  }

  return aligned;
};
