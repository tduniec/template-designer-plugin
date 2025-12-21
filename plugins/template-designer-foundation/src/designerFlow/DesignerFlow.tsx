import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  ComponentType,
  createElement,
} from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import {
  ReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Node,
  Edge,
  NodeChange,
  EdgeChange,
  useNodesState,
  ReactFlowInstance,
  NodeProps,
  NodeTypes,
  Viewport,
  OnMoveEnd,
  OnMove,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type {
  ScaffolderTaskOutput,
  TaskStep,
} from "@backstage/plugin-scaffolder-common";
import type {
  ActionNodeData,
  OutputNodeData,
  ParametersNodeData,
  TemplateParametersValue,
} from "../types/flowNodes";
import {
  buildNodesFromModel,
  collectParameterReferences,
  collectStepOutputReferences,
  stableStringify,
  extractStepsFromNodes,
  extractParametersFromNodes,
  extractOutputFromNodes,
} from "./model";
import { createSequentialEdges } from "../utils/createSequentialEdges";
import {
  buildEdgeHashMap,
  buildNodeHashMap,
  mergeEdgesWithStability,
  mergeNodesWithStability,
} from "./utils/stableComparators";
import {
  createHandleAddNode,
  createHandleRemoveNode,
  createHandleRemoveInputKey,
  createHandleReorderAndAlignNodes,
  createHandleUpdateField,
  createHandleUpdateInput,
  createHandleUpdateOutput,
  createHandleUpdateSections,
} from "./handlers";
import { alignNodes, resolveNodeHeightForTracking } from "./nodeLayout";
import {
  FLOW_LAYOUT,
  nodeDefaults as baseNodeDefaults,
} from "../components/designerFlowConfig";
import { useScaffolderActions } from "../api/useScaffolderActions";

const EMPTY_EDGES: Edge[] = [];
const EMIT_DEBOUNCE_MS = 1200; // Emit only after user pauses typing for a bit (more relaxed UX).
const VIEWPORT_TUNING = {
  alignDebounceMs: 120, // Debounce view/align updates so typing isn't interrupted by layout thrash.
  centerDurationMs: 280,
  fitFallbackDelayMs: 50,
};

// Prevent benign ResizeObserver loop errors from bubbling to the dev overlay.
if (
  typeof window !== "undefined" &&
  !(window as any).__rfResizeObserverPatched
) {
  (window as any).__rfResizeObserverPatched = true;
  // Wrap ResizeObserver callbacks in rAF to avoid sync measurement loops that trigger the warning.
  if (typeof window.ResizeObserver === "function") {
    const OriginalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = class extends OriginalResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        super((entries, observer) => {
          window.requestAnimationFrame(() => callback(entries, observer));
        });
      }
    } as typeof ResizeObserver;
  }
  const shouldSwallow = (message: unknown) =>
    typeof message === "string" &&
    message.includes("ResizeObserver loop completed with undelivered");
  const swallowResizeObserverError = (event: ErrorEvent) => {
    const message =
      event?.message || (event as any)?.error?.message || String(event);
    if (shouldSwallow(message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
    return undefined;
  };
  const swallowResizeObserverRejection = (event: PromiseRejectionEvent) => {
    const message = (event.reason as any)?.message ?? String(event.reason);
    if (shouldSwallow(message)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return true;
    }
    return undefined;
  };
  const swallowLoopEvent = (event: Event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const originalOnError = window.onerror;
  window.onerror = function handleResizeObserverOnError(
    message,
    source,
    lineno,
    colno,
    error
  ): boolean | void {
    if (
      shouldSwallow(
        typeof message === "string"
          ? message
          : (error as any)?.message ?? String(message)
      )
    ) {
      return true;
    }
    if (typeof originalOnError === "function") {
      return originalOnError(message, source, lineno, colno, error);
    }
    return undefined;
  };
  const originalOnUnhandledRejection = window.onunhandledrejection;
  window.onunhandledrejection = function handleResizeObserverOnUnhandled(
    event
  ) {
    const reason = (event as any)?.reason;
    const message =
      (reason as any)?.message ?? (typeof reason === "string" ? reason : "");
    if (shouldSwallow(message)) {
      return true;
    }
    if (typeof originalOnUnhandledRejection === "function") {
      return (originalOnUnhandledRejection as any)(event);
    }
    return undefined;
  };
  window.addEventListener("error", swallowResizeObserverError, true);
  window.addEventListener(
    "unhandledrejection",
    swallowResizeObserverRejection,
    true
  );
  window.addEventListener(
    "resizeobserverlooperror" as any,
    swallowLoopEvent,
    true
  );
}

const shallowArrayEqual = (a?: string[], b?: string[]) => {
  if (a === b) {
    return true;
  }
  if (!a || !b || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

// Main orchestration component that renders and synchronizes the Designer flow.

const FIXED_X_POSITION = FLOW_LAYOUT.fixedXPosition;
const VERTICAL_SPACING = FLOW_LAYOUT.verticalSpacing;

export type DesignerFlowProps = {
  steps?: TaskStep[];
  parameters?: TemplateParametersValue;
  output?: ScaffolderTaskOutput | null;
  onStepsChange?: (steps: TaskStep[]) => void;
  onParametersChange?: (parameters: TemplateParametersValue) => void;
  onOutputChange?: (output: ScaffolderTaskOutput | undefined) => void;
  actionNodeComponent: ComponentType<{ data: ActionNodeData }>;
  parametersNodeComponent: ComponentType<{ data: ParametersNodeData }>;
  outputNodeComponent: ComponentType<{ data: OutputNodeData }>;
  decorateNodes?: (nodes: Node[]) => Node[];
  decorateEdges?: (edges: Edge[], nodes: Node[]) => Edge[];
  nodeDefaults?: Partial<Node>;
};

export default function DesignerFlow({
  steps = [],
  parameters,
  output,
  onStepsChange,
  onParametersChange,
  onOutputChange,
  actionNodeComponent,
  parametersNodeComponent,
  outputNodeComponent,
  decorateNodes,
  decorateEdges,
  nodeDefaults = baseNodeDefaults,
}: DesignerFlowProps) {
  const nodeDataHashRef = useRef<Record<string, string>>({});
  const edgeDataHashRef = useRef<Record<string, string>>({});
  const scaffolderActionsCache = useScaffolderActions();

  const {
    ids: scaffolderActionIds,
    inputsById: scaffolderActionInputsById,
    outputsById: scaffolderActionOutputsById,
    inputRequiredById: scaffolderActionInputRequiredById,
  } = scaffolderActionsCache;

  const normalizedParametersProp = parameters ?? undefined;
  const normalizedOutputProp = output ?? null;
  const pendingFocusNodeIdRef = useRef<string | null>(null);
  const hasMountedRef = useRef(false);
  const lastNodeCountRef = useRef(0);

  const initialNodes = useMemo(() => {
    const built = buildNodesFromModel(
      steps,
      normalizedParametersProp,
      normalizedOutputProp,
      {
        scaffolderActionIds,
        scaffolderActionInputsById,
        scaffolderActionOutputsById,
        scaffolderActionInputRequiredById,
      }
    );
    const nodes = decorateNodes ? decorateNodes(built) : built;
    nodeDataHashRef.current = buildNodeHashMap(nodes);
    return nodes;
  }, [
    steps,
    normalizedParametersProp,
    normalizedOutputProp,
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
    scaffolderActionInputRequiredById,
    decorateNodes,
  ]);

  const [nodes, setNodes] = useNodesState(initialNodes);
  const initialEdges = useMemo(() => {
    const edges = decorateEdges
      ? decorateEdges(createSequentialEdges(initialNodes), initialNodes)
      : createSequentialEdges(initialNodes);
    edgeDataHashRef.current = buildEdgeHashMap(edges);
    lastNodeCountRef.current = initialNodes.length;
    return edges;
  }, [decorateEdges, initialNodes]);

  const [edges, setEdges] = useState<Edge[]>(initialEdges);

  const modelHash = useMemo(
    () =>
      stableStringify({
        steps,
        parameters: normalizedParametersProp,
        output: normalizedOutputProp,
      }),
    [steps, normalizedParametersProp, normalizedOutputProp]
  );

  const cacheFingerprint = useMemo(
    () =>
      stableStringify({
        ids: scaffolderActionIds,
        inputs: scaffolderActionInputsById,
        outputs: scaffolderActionOutputsById,
        inputRequired: scaffolderActionInputRequiredById,
      }),
    [
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
      scaffolderActionInputRequiredById,
    ]
  );

  const lastAppliedModelHashRef = useRef<string | null>(null);
  const lastEmittedModelHashRef = useRef<string | null>(null);
  const lastCacheFingerprintRef = useRef<string | null>(null);
  const nodeHeightsRef = useRef<Record<string, number>>({});
  const lastViewportRef = useRef<Viewport | null>(null);
  const emitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const emitAfterDragRef = useRef(false);
  const pendingInitialFitRef = useRef(true);
  const userMovedViewportRef = useRef(false);
  const layoutInitializedRef = useRef(false);
  const [viewport, setViewport] = useState<Viewport | null>(() => {
    const existing = lastViewportRef.current;
    if (existing) {
      return existing;
    }
    const fallback = { x: 0, y: 0, zoom: 1 };
    lastViewportRef.current = fallback;
    return fallback;
  });
  const fitViewRafRef = useRef<number | null>(null);
  const fitViewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alignDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setViewportIfChanged = useCallback((next: Viewport | null) => {
    if (!next) {
      return;
    }
    const prev = lastViewportRef.current;
    if (
      prev &&
      prev.x === next.x &&
      prev.y === next.y &&
      prev.zoom === next.zoom
    ) {
      return;
    }
    lastViewportRef.current = next;
    setViewport(next);
  }, []);
  useEffect(() => {
    const isCacheChanged = cacheFingerprint !== lastCacheFingerprintRef.current;
    const prevAppliedModelHash = lastAppliedModelHashRef.current;

    if (modelHash === lastAppliedModelHashRef.current && !isCacheChanged) {
      return;
    }

    const builtNodes = buildNodesFromModel(
      steps,
      normalizedParametersProp,
      normalizedOutputProp,
      {
        scaffolderActionIds,
        scaffolderActionInputsById,
        scaffolderActionOutputsById,
        scaffolderActionInputRequiredById,
      }
    );

    const nextNodes = decorateNodes ? decorateNodes(builtNodes) : builtNodes;
    const isInitialMount = !hasMountedRef.current;
    const shouldReplaceNodes =
      prevAppliedModelHash !== modelHash || isInitialMount;

    lastAppliedModelHashRef.current = modelHash;
    lastCacheFingerprintRef.current = cacheFingerprint;
    lastEmittedModelHashRef.current = modelHash;

    setNodes((currentNodes) => {
      if (shouldReplaceNodes) {
        nodeDataHashRef.current = buildNodeHashMap(nextNodes);
        nodeHeightsRef.current = {};
        return nextNodes;
      }
      return mergeNodesWithStability(currentNodes, nextNodes, nodeDataHashRef);
    });
    setEdges((currentEdges) => {
      const newEdges = decorateEdges
        ? decorateEdges(createSequentialEdges(nextNodes), nextNodes)
        : createSequentialEdges(nextNodes);
      if (shouldReplaceNodes) {
        edgeDataHashRef.current = buildEdgeHashMap(newEdges);
        return newEdges;
      }
      return mergeEdgesWithStability(currentEdges, newEdges, edgeDataHashRef);
    });
    hasMountedRef.current = true;
    lastNodeCountRef.current = nextNodes.length;
    if (isInitialMount) {
      pendingInitialFitRef.current = true;
    }
  }, [
    steps,
    normalizedParametersProp,
    normalizedOutputProp,
    modelHash,
    cacheFingerprint,
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
    scaffolderActionInputRequiredById,
    decorateNodes,
    decorateEdges,
    setNodes,
    setEdges,
  ]);

  const lastParameterResizeRef = useRef<{
    id: string;
    prevHeight: number;
    nextHeight: number;
  } | null>(null);

  useEffect(() => {
    if (!nodes.length) {
      return;
    }

    if (nodes.some((node) => node.dragging)) {
      return;
    }

    const activeNodeIds = new Set<string>();
    let hasMeasuredChange = false;
    let parameterResize: {
      id: string;
      prevHeight: number;
      nextHeight: number;
    } | null = null;

    nodes.forEach((node) => {
      activeNodeIds.add(node.id);
      const measuredHeight = resolveNodeHeightForTracking(node);
      if (typeof measuredHeight !== "number") {
        return;
      }
      const previousHeight = nodeHeightsRef.current[node.id];
      const heightDelta =
        previousHeight === undefined
          ? Number.POSITIVE_INFINITY
          : Math.abs(previousHeight - measuredHeight);
      if (heightDelta >= 1) {
        if (node.type === "parametersNode") {
          parameterResize = {
            id: node.id,
            prevHeight: previousHeight ?? measuredHeight,
            nextHeight: measuredHeight,
          };
        }
        nodeHeightsRef.current[node.id] = measuredHeight;
        hasMeasuredChange = true;
      } else if (previousHeight === undefined) {
        // Initialize tracking even if we consider the change too small to react to layout.
        nodeHeightsRef.current[node.id] = measuredHeight;
      }
    });

    Object.keys(nodeHeightsRef.current).forEach((id) => {
      if (!activeNodeIds.has(id)) {
        delete nodeHeightsRef.current[id];
      }
    });

    if (!hasMeasuredChange) {
      return;
    }

    if (!layoutInitializedRef.current) {
      // Skip the first post-measure align to avoid initial jump; positions are already close to target.
      layoutInitializedRef.current = true;
      return;
    }

    lastParameterResizeRef.current = parameterResize;

    if (alignDebounceRef.current) {
      clearTimeout(alignDebounceRef.current);
    }
    alignDebounceRef.current = setTimeout(() => {
      alignDebounceRef.current = null;
      setNodes((currentNodes) => {
        const resize = lastParameterResizeRef.current;
        const updated = currentNodes.map((node) => {
          if (node.type !== "parametersNode") {
            return node;
          }
          if (!resize || resize.id !== node.id) {
            // Keep x locked even if there was no measured change.
            return {
              ...node,
              position: { ...node.position, x: FIXED_X_POSITION },
            };
          }
          const prevBottom = node.position.y + resize.prevHeight;
          const nextY = Math.max(0, prevBottom - resize.nextHeight);
          if (node.position.y === nextY) {
            return {
              ...node,
              position: { ...node.position, x: FIXED_X_POSITION },
            };
          }
          return {
            ...node,
            position: { x: FIXED_X_POSITION, y: nextY },
          };
        });

        const alignedNodes = alignNodes(
          updated,
          FIXED_X_POSITION,
          VERTICAL_SPACING
        );
        const positionsChanged = alignedNodes.some((node, index) => {
          const previousNode = currentNodes[index];
          if (!previousNode) {
            return true;
          }
          return (
            node.position.x !== previousNode.position.x ||
            node.position.y !== previousNode.position.y
          );
        });

        return positionsChanged ? alignedNodes : currentNodes;
      });
    }, VIEWPORT_TUNING.alignDebounceMs);
  }, [nodes, setNodes]);

  const parameterReferences = useMemo(
    () => collectParameterReferences(normalizedParametersProp),
    [normalizedParametersProp]
  );

  const stepOutputReferencesByNode = useMemo(
    () => collectStepOutputReferences(nodes, parameterReferences),
    [nodes, parameterReferences]
  );

  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) =>
      setNodes((ns) => {
        if (
          changes.some(
            (change) => change.type === "position" && change.dragging
          )
        ) {
          isDraggingRef.current = true;
          setIsDragging(true);
        } else if (
          changes.some(
            (change) => change.type === "position" && change.dragging === false
          )
        ) {
          const stillDragging = ns.some((node) => node.dragging);
          isDraggingRef.current = stillDragging;
          setIsDragging(stillDragging);
        }
        return applyNodeChanges(changes, ns);
      }),
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) =>
      setEdges((es) => applyEdgeChanges(changes, es)),
    [setEdges]
  );

  const resolvedNodeTypes = useMemo<NodeTypes>(
    () => ({
      parametersNode: ((props: NodeProps) =>
        createElement(parametersNodeComponent, {
          data: props.data as ParametersNodeData,
        })) as ComponentType<NodeProps>,
      actionNode: ((props: NodeProps) =>
        createElement(actionNodeComponent, {
          data: props.data as ActionNodeData,
        })) as ComponentType<NodeProps>,
      outputNode: ((props: NodeProps) =>
        createElement(outputNodeComponent, {
          data: props.data as OutputNodeData,
        })) as ComponentType<NodeProps>,
    }),
    [actionNodeComponent, outputNodeComponent, parametersNodeComponent]
  );

  const onConnect = useCallback(
    (params: any) => setEdges((es) => addEdge(params, es)),
    [setEdges]
  );

  const reorderAndAlignNodes = useMemo(
    () =>
      createHandleReorderAndAlignNodes(setNodes, setEdges, {
        fixedXPosition: FIXED_X_POSITION,
        verticalSpacing: VERTICAL_SPACING,
      }),
    [setNodes, setEdges]
  );

  const onNodeDragStop = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      isDraggingRef.current = false;
      setIsDragging(false);
      reorderAndAlignNodes(node);
    },
    [reorderAndAlignNodes]
  );

  const onUpdateField = useMemo(
    () => createHandleUpdateField(setNodes),
    [setNodes]
  );

  const onUpdateInput = useMemo(
    () => createHandleUpdateInput(setNodes),
    [setNodes]
  );

  const onRemoveInputKey = useMemo(
    () => createHandleRemoveInputKey(setNodes),
    [setNodes]
  );

  const onUpdateOutput = useMemo(
    () => createHandleUpdateOutput(setNodes),
    [setNodes]
  );

  const onUpdateSections = useMemo(
    () => createHandleUpdateSections(setNodes),
    [setNodes]
  );

  const handleAddNode = useMemo(
    () =>
      createHandleAddNode(setNodes, setEdges, {
        fixedXPosition: FIXED_X_POSITION,
        verticalSpacing: VERTICAL_SPACING,
        nodeDefaults,
        scaffolderActionIds,
        scaffolderActionInputsById,
        scaffolderActionInputRequiredById,
        scaffolderActionOutputsById,
        onNodeAdded: (rfId: string) => {
          pendingFocusNodeIdRef.current = rfId;
          // Keep current zoom/viewport; focus will center on the new node.
          pendingInitialFitRef.current = false;
        },
      }),
    [
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
      scaffolderActionInputRequiredById,
      nodeDefaults,
      setNodes,
      setEdges,
    ]
  );

  const handleRemoveNode = useMemo(
    () =>
      createHandleRemoveNode(setNodes, setEdges, {
        fixedXPosition: FIXED_X_POSITION,
        verticalSpacing: VERTICAL_SPACING,
      }),
    [setNodes, setEdges]
  );

  const emitChanges = useCallback(() => {
    if (!onStepsChange && !onParametersChange && !onOutputChange) {
      return;
    }
    const stepsFromNodes = extractStepsFromNodes(nodes);
    const parametersFromNodes = extractParametersFromNodes(nodes);
    const outputFromNodes = extractOutputFromNodes(nodes);

    const nextHash = stableStringify({
      steps: stepsFromNodes,
      parameters: parametersFromNodes,
      output: outputFromNodes,
    });

    if (nextHash === lastEmittedModelHashRef.current) {
      return;
    }

    lastEmittedModelHashRef.current = nextHash;
    onStepsChange?.(stepsFromNodes);
    onParametersChange?.(parametersFromNodes);
    onOutputChange?.(outputFromNodes);
  }, [
    nodes,
    onOutputChange,
    onParametersChange,
    onStepsChange,
    lastEmittedModelHashRef,
  ]);

  const emitChangesDeferred = useCallback(() => {
    if (emitDebounceRef.current) {
      clearTimeout(emitDebounceRef.current);
    }
    emitDebounceRef.current = setTimeout(() => {
      emitChanges();
      emitDebounceRef.current = null;
    }, EMIT_DEBOUNCE_MS);
  }, [emitChanges]);

  const flushPendingEmit = useCallback(() => {
    if (emitDebounceRef.current) {
      clearTimeout(emitDebounceRef.current);
      emitDebounceRef.current = null;
    }
    emitChanges();
  }, [emitChanges]);

  // Hoist handler/data refs into state so ReactFlow sees unchanged node objects when nothing relevant changed.
  const ensureNodeDataStability = useCallback(
    (node: Node): Node => {
      if (node.type === "actionNode") {
        const data = node.data as ActionNodeData;
        const nextRefs =
          stepOutputReferencesByNode[node.id] ?? data.stepOutputReferences;
        const refsUnchanged = shallowArrayEqual(
          data.stepOutputReferences,
          nextRefs
        );

        const hasSameHandlers =
          data.onAddNode === handleAddNode &&
          data.onRemoveNode === handleRemoveNode &&
          data.onUpdateField === onUpdateField &&
          data.onUpdateInput === onUpdateInput &&
          data.onRemoveInputKey === onRemoveInputKey;
        const hasSameCaches =
          data.scaffolderActionIds === scaffolderActionIds &&
          data.scaffolderActionInputsById === scaffolderActionInputsById &&
          data.scaffolderActionOutputsById === scaffolderActionOutputsById &&
          data.scaffolderActionInputRequiredById ===
            scaffolderActionInputRequiredById;

        if (hasSameHandlers && hasSameCaches && refsUnchanged) {
          return node;
        }

        return {
          ...node,
          data: {
            ...data,
            onAddNode: handleAddNode,
            onRemoveNode: handleRemoveNode,
            onUpdateField,
            onUpdateInput,
            onRemoveInputKey,
            scaffolderActionIds,
            scaffolderActionInputsById,
            scaffolderActionOutputsById,
            scaffolderActionInputRequiredById,
            stepOutputReferences: refsUnchanged
              ? data.stepOutputReferences
              : nextRefs,
          },
        };
      }

      if (node.type === "outputNode") {
        const data = node.data as OutputNodeData;
        const nextRefs =
          stepOutputReferencesByNode[node.id] ?? data.stepOutputReferences;
        const refsUnchanged = shallowArrayEqual(
          data.stepOutputReferences,
          nextRefs
        );
        const hasSameHandlers =
          data.onUpdateOutput === onUpdateOutput &&
          data.onRemoveNode === handleRemoveNode &&
          data.onAddNode === handleAddNode;

        const hasSameCaches =
          data.scaffolderActionIds === scaffolderActionIds &&
          data.scaffolderActionInputsById === scaffolderActionInputsById &&
          data.scaffolderActionOutputsById === scaffolderActionOutputsById &&
          data.scaffolderActionInputRequiredById ===
            scaffolderActionInputRequiredById;

        if (hasSameHandlers && hasSameCaches && refsUnchanged) {
          return node;
        }

        return {
          ...node,
          data: {
            ...data,
            onUpdateOutput,
            onRemoveNode: handleRemoveNode,
            onAddNode: handleAddNode,
            scaffolderActionIds,
            scaffolderActionInputsById,
            scaffolderActionOutputsById,
            scaffolderActionInputRequiredById,
            stepOutputReferences: refsUnchanged
              ? data.stepOutputReferences
              : nextRefs,
          },
        };
      }

      if (node.type === "parametersNode") {
        const data = node.data as ParametersNodeData;
        const hasSameHandlers =
          data.onUpdateSections === onUpdateSections &&
          data.onRemoveNode === handleRemoveNode &&
          data.onAddNode === handleAddNode;
        const hasSameCaches =
          data.scaffolderActionIds === scaffolderActionIds &&
          data.scaffolderActionInputsById === scaffolderActionInputsById &&
          data.scaffolderActionOutputsById === scaffolderActionOutputsById &&
          data.scaffolderActionInputRequiredById ===
            scaffolderActionInputRequiredById;

        if (hasSameHandlers && hasSameCaches) {
          return node;
        }

        return {
          ...node,
          data: {
            ...data,
            onUpdateSections,
            onRemoveNode: handleRemoveNode,
            onAddNode: handleAddNode,
            scaffolderActionIds,
            scaffolderActionInputsById,
            scaffolderActionOutputsById,
            scaffolderActionInputRequiredById,
          },
        };
      }

      return node;
    },
    [
      handleAddNode,
      handleRemoveNode,
      onUpdateField,
      onUpdateInput,
      onRemoveInputKey,
      onUpdateOutput,
      onUpdateSections,
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
      scaffolderActionInputRequiredById,
      stepOutputReferencesByNode,
    ]
  );

  useEffect(() => {
    setNodes((currentNodes) => {
      let changed = false;
      const nextNodes = currentNodes.map((node) => {
        const updated = ensureNodeDataStability(node);
        if (updated !== node) {
          changed = true;
        }
        return updated;
      });

      // Returning the same array keeps ReactFlow nodes prop stable unless something truly changed.
      return changed ? nextNodes : currentNodes;
    });
  }, [ensureNodeDataStability, setNodes]);

  useEffect(() => {
    emitChangesDeferred();
  }, [nodes, emitChangesDeferred]);

  useEffect(() => {
    // Force next emit to run even if hash matches, so input edits flush to YAML.
    lastEmittedModelHashRef.current = null;
  }, [nodes]);

  useEffect(() => {
    if (!nodes.length) {
      return;
    }
    emitChangesDeferred();
  }, [emitChangesDeferred, modelHash, nodes]);

  useEffect(() => {
    return () => {
      if (emitDebounceRef.current) {
        clearTimeout(emitDebounceRef.current);
      }
      if (fitViewRafRef.current !== null) {
        cancelAnimationFrame(fitViewRafRef.current);
        fitViewRafRef.current = null;
      }
      if (fitViewTimeoutRef.current) {
        clearTimeout(fitViewTimeoutRef.current);
        fitViewTimeoutRef.current = null;
      }
      if (alignDebounceRef.current) {
        clearTimeout(alignDebounceRef.current);
      }
      flushPendingEmit();
    };
  }, [flushPendingEmit]);

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const fitFlowToView = useCallback(() => {
    if (!reactFlowInstance || !nodes.length) {
      return;
    }
    if (fitViewRafRef.current !== null) {
      return;
    }
    if (userMovedViewportRef.current && !pendingInitialFitRef.current) {
      // Respect user navigation; don't snap back after they moved the camera.
      return;
    }
    const nodeWithWidth = nodes.find((node) => node.width);
    const nodeWidth = nodeWithWidth?.width ?? 760;
    const padding = Math.max((window.innerWidth - nodeWidth) / 2 - 24, 60);
    const viewOptions = {
      padding,
      minZoom: 0.2,
    };
    // Delay fitView to the next frame to avoid ResizeObserver loops while nodes mount/measure.
    fitViewRafRef.current = window.requestAnimationFrame(() => {
      fitViewRafRef.current = null;
      try {
        reactFlowInstance.fitView(viewOptions);
        setViewportIfChanged(reactFlowInstance.getViewport());
      } catch {
        // Swallow rare layout timing errors; the next change will try again.
      }
    });
    // Fallback in case RAF is skipped (tab in background).
    if (fitViewTimeoutRef.current) {
      clearTimeout(fitViewTimeoutRef.current);
    }
    fitViewTimeoutRef.current = setTimeout(() => {
      fitViewTimeoutRef.current = null;
      try {
        reactFlowInstance.fitView(viewOptions);
        setViewportIfChanged(reactFlowInstance.getViewport());
      } catch {
        // Ignore; typically triggered only during tab throttling.
      }
    }, VIEWPORT_TUNING.fitFallbackDelayMs);
  }, [nodes, reactFlowInstance, setViewportIfChanged]);

  useEffect(() => {
    if (!reactFlowInstance) {
      return;
    }
    if (viewport === null) {
      setViewportIfChanged(viewport);
    }
    if (!pendingInitialFitRef.current) {
      return;
    }
    pendingInitialFitRef.current = false;
    fitFlowToView();
  }, [
    fitFlowToView,
    nodes,
    edges,
    reactFlowInstance,
    viewport,
    setViewportIfChanged,
  ]);

  useEffect(() => {
    const swallowResizeObserverError = (event: ErrorEvent) => {
      const message =
        event?.message || (event as any)?.error?.message || String(event);
      if (
        typeof message === "string" &&
        message.includes("ResizeObserver loop")
      ) {
        // Prevent dev overlay noise for benign ResizeObserver timing loops that appear after fitView/layout.
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    const swallowResizeObserverRejection = (event: PromiseRejectionEvent) => {
      const message = (event.reason as any)?.message ?? String(event.reason);
      if (
        typeof message === "string" &&
        message.includes("ResizeObserver loop")
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("error", swallowResizeObserverError, true);
    window.addEventListener(
      "unhandledrejection",
      swallowResizeObserverRejection,
      true
    );
    // Chrome/FF dispatch a dedicated event for this condition; capture it to prevent overlay noise.
    const swallowLoopErrorEvent = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener(
      "resizeobserverlooperror" as any,
      swallowLoopErrorEvent,
      true
    );
    return () => {
      window.removeEventListener("error", swallowResizeObserverError, true);
      window.removeEventListener(
        "unhandledrejection",
        swallowResizeObserverRejection,
        true
      );
      window.removeEventListener(
        "resizeobserverlooperror" as any,
        swallowLoopErrorEvent,
        true
      );
    };
  }, []);

  useEffect(() => {
    if (!reactFlowInstance) {
      return undefined;
    }
    window.addEventListener("resize", fitFlowToView);
    return () => {
      window.removeEventListener("resize", fitFlowToView);
    };
  }, [fitFlowToView, reactFlowInstance]);

  useEffect(() => {
    if (!isDragging) {
      if (emitAfterDragRef.current) {
        emitAfterDragRef.current = false;
        lastEmittedModelHashRef.current = null;
      }
      // Trigger emit cycle after drag ends so external state is up to date.
      lastEmittedModelHashRef.current = null;
    }
  }, [isDragging]);

  const handleMoveEnd: OnMoveEnd = useCallback(
    (_event, nextViewport: Viewport) => {
      // Keep zoom stable to optionally cull edges when zoomed out.
      setViewportIfChanged(nextViewport);
    },
    [setViewportIfChanged]
  );

  const handleMove: OnMove = useCallback(
    (_, nextViewport) => {
      userMovedViewportRef.current = true;
      setViewportIfChanged(nextViewport);
    },
    [setViewportIfChanged]
  );

  const shouldCullEdges =
    edges.length > 300 && (viewport?.zoom ?? 1) < 0.3 && !isDragging;
  const renderedEdges = useMemo(
    () =>
      shouldCullEdges
        ? EMPTY_EDGES // Dropping edges when zoomed out keeps canvas responsive with huge graphs.
        : edges,
    [edges, shouldCullEdges]
  );

  useEffect(() => {
    if (!reactFlowInstance) {
      return;
    }
    const pendingId = pendingFocusNodeIdRef.current;
    if (!pendingId) {
      return;
    }
    const target = nodes.find((node) => node.id === pendingId);
    if (!target) {
      return;
    }
    pendingFocusNodeIdRef.current = null;
    const nodeCenterX = target.position.x + (target.width ?? 0) / 2;
    const nodeCenterY = target.position.y + (target.height ?? 0) / 2;
    const zoom = viewport?.zoom ?? lastViewportRef.current?.zoom ?? undefined;
    try {
      reactFlowInstance.setCenter(nodeCenterX, nodeCenterY, {
        zoom,
        duration: VIEWPORT_TUNING.centerDurationMs,
      });
      window.requestAnimationFrame(() => {
        setViewportIfChanged(reactFlowInstance.getViewport());
      });
    } catch {
      // ignore
    }
  }, [nodes, reactFlowInstance, viewport, setViewportIfChanged]);

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={renderedEdges}
        nodeTypes={resolvedNodeTypes}
        defaultViewport={
          viewport ?? {
            x: 0,
            y: 0,
            zoom: 1,
          }
        }
        viewport={viewport ?? undefined}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onMove={handleMove}
        onlyRenderVisibleElements
        onInit={setReactFlowInstance}
        onMoveEnd={handleMoveEnd}
      />
    </div>
  );
}
