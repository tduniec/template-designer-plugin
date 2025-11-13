import type { Node } from "@xyflow/react";

// Shared helpers for computing consistent node alignment/spacing in the flow.

const DEFAULT_NODE_HEIGHT = 320;
const MIN_VERTICAL_GAP = 48;

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
  return DEFAULT_NODE_HEIGHT;
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
    const distanceToNext = Math.max(
      nodeHeight + MIN_VERTICAL_GAP,
      verticalSpacing
    );
    currentY += distanceToNext;

    return alignedNode;
  });
};
