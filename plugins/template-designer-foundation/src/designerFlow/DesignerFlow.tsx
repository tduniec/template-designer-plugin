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
    return decorateNodes ? decorateNodes(built) : built;
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
  const [edges, setEdges] = useState<Edge[]>(() =>
    decorateEdges
      ? decorateEdges(createSequentialEdges(initialNodes), initialNodes)
      : createSequentialEdges(initialNodes)
  );

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

    setNodes(nextNodes);
    setEdges(
      decorateEdges
        ? decorateEdges(createSequentialEdges(nextNodes), nextNodes)
        : createSequentialEdges(nextNodes)
    );
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

  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((node) => {
        if (node.type === "actionNode") {
          const data = node.data as ActionNodeData;
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
              stepOutputReferences:
                stepOutputReferencesByNode[node.id] ??
                stepOutputReferencesByNode[node.id],
            },
          };
        }

        if (node.type === "outputNode") {
          const data = node.data as OutputNodeData;
          return {
            ...node,
            data: {
              ...data,
              onUpdateOutput,
              onRemoveNode: handleRemoveNode,
              onAddNode: handleAddNode,
              stepOutputReferences:
                stepOutputReferencesByNode[node.id] ??
                stepOutputReferencesByNode[node.id],
            },
          };
        }

        if (node.type === "parametersNode") {
          const data = node.data as ParametersNodeData;
          return {
            ...node,
            data: {
              ...data,
              onUpdateSections,
              onRemoveNode: handleRemoveNode,
              onAddNode: handleAddNode,
            },
          };
        }

        return node;
      }),
    [
      nodes,
      handleAddNode,
      handleRemoveNode,
      onUpdateField,
      onUpdateInput,
      onRemoveInputKey,
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
      scaffolderActionInputRequiredById,
      stepOutputReferencesByNode,
      onUpdateOutput,
      onUpdateSections,
    ]
  );

  useEffect(() => {
    emitChangesDeferred();
  }, [nodesWithHandlers, emitChangesDeferred]);

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

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "100%" }}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        nodeTypes={resolvedNodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        fitView
        onInit={setReactFlowInstance}
      />
    </div>
  );
}
