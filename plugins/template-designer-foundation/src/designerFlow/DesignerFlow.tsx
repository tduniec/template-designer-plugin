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
  const shouldAutoFitViewRef = useRef(true);
  const emitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const emitAfterDragRef = useRef(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);

  useEffect(() => {
    const isCacheChanged = cacheFingerprint !== lastCacheFingerprintRef.current;

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

    lastAppliedModelHashRef.current = modelHash;
    lastCacheFingerprintRef.current = cacheFingerprint;
    lastEmittedModelHashRef.current = modelHash;

    setNodes((currentNodes) => {
      const merged = mergeNodesWithStability(
        currentNodes,
        nextNodes,
        nodeDataHashRef
      );
      return merged;
    });
    setEdges((currentEdges) => {
      const newEdges = decorateEdges
        ? decorateEdges(createSequentialEdges(nextNodes), nextNodes)
        : createSequentialEdges(nextNodes);
      const merged = mergeEdgesWithStability(
        currentEdges,
        newEdges,
        edgeDataHashRef
      );
      return merged;
    });
    shouldAutoFitViewRef.current = true;
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

  useEffect(() => {
    if (!nodes.length) {
      return;
    }

    if (nodes.some((node) => node.dragging)) {
      return;
    }

    const activeNodeIds = new Set<string>();
    let hasMeasuredChange = false;

    nodes.forEach((node) => {
      activeNodeIds.add(node.id);
      const measuredHeight = resolveNodeHeightForTracking(node);
      if (typeof measuredHeight !== "number") {
        return;
      }
      const previousHeight = nodeHeightsRef.current[node.id];
      if (previousHeight !== measuredHeight) {
        nodeHeightsRef.current[node.id] = measuredHeight;
        hasMeasuredChange = true;
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

    setNodes((currentNodes) => {
      const alignedNodes = alignNodes(
        currentNodes,
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
    }, 25);
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
    };
  }, []);

  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);
  const fitFlowToView = useCallback(() => {
    if (!reactFlowInstance) {
      return;
    }
    const nodeWithWidth = nodes.find((node) => node.width);
    const nodeWidth = nodeWithWidth?.width ?? 760;
    const padding = Math.max((window.innerWidth - nodeWidth) / 2 - 24, 60);
    const viewOptions = {
      padding,
      minZoom: 0.2,
    };
    if (!nodes.length) {
      return;
    }
    reactFlowInstance.fitView(viewOptions);
  }, [reactFlowInstance, nodes]);

  useEffect(() => {
    if (!reactFlowInstance) {
      return;
    }
    if (!shouldAutoFitViewRef.current) {
      return;
    }
    shouldAutoFitViewRef.current = false;
    fitFlowToView();
  }, [fitFlowToView, nodes, edges, reactFlowInstance]);

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

  const handleMoveEnd = useCallback(
    (_: ReactMouseEvent | undefined, nextViewport: Viewport) => {
      // Keep zoom stable to optionally cull edges when zoomed out.
      setViewport(nextViewport);
    },
    []
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

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={renderedEdges}
        nodeTypes={resolvedNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        fitView
        onlyRenderVisibleElements
        onInit={setReactFlowInstance}
        onMoveEnd={handleMoveEnd}
      />
    </div>
  );
}
