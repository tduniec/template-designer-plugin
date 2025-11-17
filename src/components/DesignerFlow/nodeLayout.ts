import type { Node } from "@xyflow/react";
import type {
  ActionNodeData,
  DesignerNodeType,
  OutputNodeData,
  ParametersNodeData,
} from "../Nodes/types";
import { NODE_VERTICAL_SPACING } from "../Nodes/types";

// Shared helpers for computing consistent node alignment/spacing in the flow.

const DEFAULT_NODE_HEIGHT = 320;
const MIN_VERTICAL_GAP = 48;

const TYPE_SPACING_BUFFER: Record<DesignerNodeType, number> = {
  parametersNode: 120,
  actionNode: 120,
  outputNode: 120,
};

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
  const base = 520;
  const rowHeight = 84;
  const inputCount = Object.keys(data.step?.input ?? {}).length;
  const hasInputs = inputCount > 0 ? inputCount : 1;
  return base + hasInputs * rowHeight;
};

const BUILTIN_OUTPUT_KEYS = new Set(["links", "text"]);

const estimateOutputNodeHeight = (node: Node): number | null => {
  if (node.type !== "outputNode") {
    return null;
  }
  const data = node.data as OutputNodeData | undefined;
  if (!data) {
    return null;
  }
  const base = 240;
  const linkHeight = 68;
  const textHeight = 68;
  const customHeight = 56;

  const links = Array.isArray(data.output?.links) ? data.output.links : [];
  const textEntries = Array.isArray(data.output?.text) ? data.output.text : [];
  const customEntries =
    data.output && typeof data.output === "object"
      ? Object.entries(data.output).filter(
          ([key]) => !BUILTIN_OUTPUT_KEYS.has(key)
        )
      : [];

  return (
    base +
    links.length * linkHeight +
    textEntries.length * textHeight +
    customEntries.length * customHeight
  );
};

const getEstimatedHeightForNode = (node: Node): number | null => {
  const type = node.type as DesignerNodeType | undefined;
  if (!type) {
    return null;
  }

  const estimators: Partial<
    Record<DesignerNodeType, (node: Node) => number | null>
  > = {
    parametersNode: estimateParametersNodeHeight,
    actionNode: estimateActionNodeHeight,
    outputNode: estimateOutputNodeHeight,
  };

  const estimated = estimators[type]?.(node);
  if (typeof estimated === "number" && estimated > 0) {
    return estimated;
  }

  const fallback = NODE_VERTICAL_SPACING[type];
  return typeof fallback === "number" && fallback > 0 ? fallback : null;
};

const getNodeHeight = (node: Node): number => {
  const measured = parseNumericHeight(node.measured?.height);
  if (measured) {
    return measured;
  }
  const explicitHeight = parseNumericHeight(node.height);
  if (explicitHeight) {
    return explicitHeight;
  }
  const styleHeight = parseNumericHeight(node.style?.height);
  if (styleHeight) {
    return styleHeight;
  }
  const estimatedHeight = getEstimatedHeightForNode(node);
  if (estimatedHeight) {
    return estimatedHeight;
  }
  return DEFAULT_NODE_HEIGHT;
};

const getSpacingBufferForNode = (node: Node): number => {
  const type = node.type as DesignerNodeType | undefined;
  if (!type) {
    return MIN_VERTICAL_GAP;
  }
  const buffer = TYPE_SPACING_BUFFER[type] ?? MIN_VERTICAL_GAP;
  return buffer > MIN_VERTICAL_GAP ? buffer : MIN_VERTICAL_GAP;
};

export const alignNodes = (
  nodes: Node[],
  fixedXPosition: number,
  verticalSpacing: number
) => {
  let currentY = 0;

  return nodes.map((node) => {
    const alignedNode: Node = {
      ...node,
      position: {
        x: fixedXPosition,
        y: currentY,
      },
    };

    const nodeHeight = getNodeHeight(node);
    const spacingBuffer = getSpacingBufferForNode(node);
    const minDistance = nodeHeight + spacingBuffer;
    const distanceToNext = Math.max(minDistance, verticalSpacing);
    currentY += distanceToNext;

    return alignedNode;
  });
};
