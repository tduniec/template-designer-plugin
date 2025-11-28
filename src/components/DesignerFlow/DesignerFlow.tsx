import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "../Nodes/types";
import { createSequentialEdges } from "../../utils/createSequentialEdges";
import {
  collectStepOutputReferences,
  createHandleAddNode,
  createHandleRemoveNode,
  createHandleRemoveInputKey,
  createHandleReorderAndAlignNodes,
  createHandleUpdateField,
  createHandleUpdateInput,
  createHandleUpdateOutput,
  createHandleUpdateSections,
} from "./handlers";
import {
  buildNodesFromModel,
  collectParameterReferences,
  stableStringify,
  resolveNodeHeightForTracking,
  extractStepsFromNodes,
  extractParametersFromNodes,
  extractOutputFromNodes,
} from "./model";
import { alignNodes } from "./nodeLayout";
import { FLOW_LAYOUT, nodeDefaults, nodeTypes } from "./flowConfig";
import { useScaffolderActions } from "../../api/scaffolderActions";

// Main orchestration component that renders and synchronizes the Designer flow.

const FIXED_X_POSITION = FLOW_LAYOUT.fixedXPosition;
const VERTICAL_SPACING = FLOW_LAYOUT.verticalSpacing;

type DesignerFlowProps = {
  steps?: TaskStep[];
  parameters?: TemplateParametersValue;
  output?: ScaffolderTaskOutput | null;
  onStepsChange?: (steps: TaskStep[]) => void;
  onParametersChange?: (parameters: TemplateParametersValue) => void;
  onOutputChange?: (output: ScaffolderTaskOutput | undefined) => void;
};

export default function App({
  steps = [],
  parameters,
  output,
  onStepsChange,
  onParametersChange,
  onOutputChange,
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

  const initialNodes = useMemo(
    () =>
      buildNodesFromModel(
        steps,
        normalizedParametersProp,
        normalizedOutputProp,
        {
          scaffolderActionIds,
          scaffolderActionInputsById,
          scaffolderActionOutputsById,
          scaffolderActionInputRequiredById,
        }
      ),
    [
      steps,
      normalizedParametersProp,
      normalizedOutputProp,
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
      scaffolderActionInputRequiredById,
    ]
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(() =>
    createSequentialEdges(initialNodes)
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
  const skipNextModelHashRef = useRef<string | null>(null);
  const lastCacheFingerprintRef = useRef<string | null>(null);
  const nodeHeightsRef = useRef<Record<string, number>>({});
  const shouldAutoFitViewRef = useRef(true);
  const emitDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasDraggingNodes = useMemo(
    () => nodes.some((node) => node.dragging),
    [nodes]
  );

  useEffect(() => {
    const isCacheChanged = cacheFingerprint !== lastCacheFingerprintRef.current;
    const shouldSkip =
      modelHash === skipNextModelHashRef.current && !isCacheChanged;

    if (shouldSkip) {
      skipNextModelHashRef.current = null;
      lastAppliedModelHashRef.current = modelHash;
      lastCacheFingerprintRef.current = cacheFingerprint;
      return;
    }

    if (modelHash === lastAppliedModelHashRef.current && !isCacheChanged) {
      return;
    }

    const nextNodes = buildNodesFromModel(
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

    lastAppliedModelHashRef.current = modelHash;
    lastCacheFingerprintRef.current = cacheFingerprint;
    lastEmittedModelHashRef.current = modelHash;

    setNodes(nextNodes);
    setEdges(createSequentialEdges(nextNodes));
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
      setNodes((ns) => applyNodeChanges(changes, ns)),
    [setNodes]
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) =>
      setEdges((es) => applyEdgeChanges(changes, es)),
    [setEdges]
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

  const nodesWithHandlers = useMemo(
    () =>
      nodes.map((node) => {
        const stepOutputReferences = stepOutputReferencesByNode[node.id] ?? [];
        if (node.type === "parametersNode") {
          const data = node.data as ParametersNodeData;
          return {
            ...node,
            data: {
              ...data,
              onAddNode: handleAddNode,
              onUpdateSections,
              stepOutputReferences,
            },
          };
        }
        if (node.type === "outputNode") {
          const data = node.data as OutputNodeData;
          return {
            ...node,
            data: {
              ...data,
              onAddNode: handleAddNode,
              onUpdateOutput,
              stepOutputReferences,
            },
          };
        }

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
            stepOutputReferences,
          },
        };
      }),
    [
      nodes,
      handleAddNode,
      handleRemoveNode,
      onUpdateField,
      onUpdateInput,
      onRemoveInputKey,
      onUpdateOutput,
      onUpdateSections,
      stepOutputReferencesByNode,
    ]
  );

  const stepsFromNodes = useMemo(() => extractStepsFromNodes(nodes), [nodes]);

  const parametersFromNodes = useMemo(
    () => extractParametersFromNodes(nodes),
    [nodes]
  );

  const outputFromNodes = useMemo(() => extractOutputFromNodes(nodes), [nodes]);

  const normalizedOutputFromNodes = outputFromNodes ?? null;

  useEffect(() => {
    if (!onStepsChange && !onParametersChange && !onOutputChange) {
      return;
    }
    if (hasDraggingNodes) {
      return;
    }
    const serialized = stableStringify({
      steps: stepsFromNodes,
      parameters: parametersFromNodes ?? null,
      output: normalizedOutputFromNodes,
    });
    if (serialized === lastEmittedModelHashRef.current) {
      return;
    }
    if (emitDebounceRef.current) {
      clearTimeout(emitDebounceRef.current);
    }
    emitDebounceRef.current = setTimeout(() => {
      lastEmittedModelHashRef.current = serialized;
      skipNextModelHashRef.current = serialized;
      if (onStepsChange) {
        onStepsChange(stepsFromNodes);
      }
      if (onParametersChange) {
        onParametersChange(parametersFromNodes ?? undefined);
      }
      if (onOutputChange) {
        onOutputChange(outputFromNodes);
      }
    }, 120);
  }, [
    stepsFromNodes,
    parametersFromNodes,
    normalizedOutputFromNodes,
    outputFromNodes,
    onStepsChange,
    onParametersChange,
    onOutputChange,
    hasDraggingNodes,
  ]);

  useEffect(
    () => () => {
      if (emitDebounceRef.current) {
        clearTimeout(emitDebounceRef.current);
      }
    },
    []
  );

  const fitViewOptions = useMemo(() => ({ padding: 0.2, duration: 300 }), []);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<ReactFlowInstance | null>(null);

  const fitFlowToView = useCallback(() => {
    if (!reactFlowInstance) {
      return;
    }
    reactFlowInstance.fitView(fitViewOptions);
  }, [fitViewOptions, reactFlowInstance]);

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

  return (
    <div style={{ width: "100%", height: "100%", minHeight: "70vh" }}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        fitView
        onInit={setReactFlowInstance}
        fitViewOptions={fitViewOptions}
      />
    </div>
  );
}
