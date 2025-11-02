import { Edge, Node } from '@xyflow/react';

export function createSequentialEdges(nodes: Node[]): Edge[] {
  if (nodes.length < 2) return [];

  return nodes.slice(0, -1).map((node, index) => {
    const nextNode = nodes[index + 1];
    return {
      id: `e-${node.id}-${nextNode.id}`,
      source: node.id,
      target: nextNode.id,
      type: 'smoothstep',
    } as Edge;
  });
}
