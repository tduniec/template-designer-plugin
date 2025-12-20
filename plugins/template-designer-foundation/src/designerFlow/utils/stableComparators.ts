import { Edge, Node, XYPosition } from "@xyflow/react";
import { stableStringify } from "../model";

type HashMap = Record<string, string>;

const positionsEqual = (a: XYPosition, b: XYPosition) =>
  a?.x === b?.x && a?.y === b?.y;

const dimensionsEqual = (a: Node, b: Node) =>
  (a.width ?? null) === (b.width ?? null) &&
  (a.height ?? null) === (b.height ?? null);

export const computeNodeHash = (node: Node) =>
  stableStringify({ type: node.type, data: node.data });

export const computeEdgeHash = (edge: Edge) =>
  stableStringify({
    source: edge.source,
    target: edge.target,
    type: edge.type,
    label: edge.label,
    data: edge.data,
  });

export const buildNodeHashMap = (nodes: Node[]): HashMap => {
  const next: HashMap = {};
  nodes.forEach((node) => {
    next[node.id] = computeNodeHash(node);
  });
  return next;
};

export const buildEdgeHashMap = (edges: Edge[]): HashMap => {
  const next: HashMap = {};
  edges.forEach((edge) => {
    next[edge.id] = computeEdgeHash(edge);
  });
  return next;
};

export const isNodeEqual = (a: Node, b: Node, prevHash: string | undefined) => {
  if (!a || !b) {
    return false;
  }
  const hashMatches = prevHash === computeNodeHash(b);
  return (
    a.type === b.type &&
    hashMatches &&
    positionsEqual(a.position, b.position) &&
    dimensionsEqual(a, b)
  );
};

export const isEdgeEqual = (a: Edge, b: Edge, prevHash: string | undefined) => {
  if (!a || !b) {
    return false;
  }
  const hashMatches = prevHash === computeEdgeHash(b);
  return (
    a.source === b.source &&
    a.target === b.target &&
    a.type === b.type &&
    a.label === b.label &&
    hashMatches
  );
};

export const mergeNodesWithStability = (
  prevNodes: Node[],
  nextNodes: Node[],
  hashRef: { current: HashMap }
) => {
  const prevMap = new Map(prevNodes.map((node) => [node.id, node]));
  const nextHashes: HashMap = {};
  let allStable = prevNodes.length === nextNodes.length;

  const merged = nextNodes.map((node, index) => {
    const prev = prevMap.get(node.id);
    const nextHash = computeNodeHash(node);
    nextHashes[node.id] = nextHash;
    if (
      prev &&
      hashRef.current[node.id] === nextHash &&
      positionsEqual(prev.position, node.position) &&
      dimensionsEqual(prev, node)
    ) {
      if (allStable && prevNodes[index] !== prev) {
        allStable = false;
      }
      return prev;
    }
    allStable = false;
    return node;
  });

  hashRef.current = nextHashes;
  return allStable ? prevNodes : merged;
};

export const mergeEdgesWithStability = (
  prevEdges: Edge[],
  nextEdges: Edge[],
  hashRef: { current: HashMap }
) => {
  const prevMap = new Map(prevEdges.map((edge) => [edge.id, edge]));
  const nextHashes: HashMap = {};
  let allStable = prevEdges.length === nextEdges.length;

  const merged = nextEdges.map((edge, index) => {
    const prev = prevMap.get(edge.id);
    const nextHash = computeEdgeHash(edge);
    nextHashes[edge.id] = nextHash;
    if (prev && hashRef.current[edge.id] === nextHash) {
      if (allStable && prevEdges[index] !== prev) {
        allStable = false;
      }
      return prev;
    }
    allStable = false;
    return edge;
  });

  hashRef.current = nextHashes;
  return allStable ? prevEdges : merged;
};
