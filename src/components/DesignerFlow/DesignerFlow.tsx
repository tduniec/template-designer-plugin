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
  Position,
  useNodesState,
  Panel,
  ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { createSequentialEdges } from "../../utils/createSequentialEdges";
import type {
  ScaffolderTaskOutput,
  TaskStep,
} from "@backstage/plugin-scaffolder-common";
import { ActionNode } from "../../nodes/ActionNode";
import { ParametersNode } from "../../nodes/ParametersNode";
import { OutputNode } from "../../nodes/OutputNode";
import type {
  ActionNodeData,
  OutputNodeData,
  ParametersNodeData,
  TemplateParametersValue,
} from "../../nodes/types";
import {
  alignNodes,
  collectStepOutputReferences,
  createHandleAddNode,
  createHandleRemoveInputKey,
  createHandleReorderAndAlignNodes,
  createHandleUpdateField,
  createHandleUpdateInput,
  createHandleUpdateOutput,
  createHandleUpdateSections,
} from "./handlers";
import { normalizeParametersToSections } from "./parameterTransforms";
import { scaffolderApiRef } from "@backstage/plugin-scaffolder-react";
import { useApi } from "@backstage/core-plugin-api";

const VERTICAL_SPACING = 400;
const FIXED_X_POSITION = 100;

const nodeTypes = {
  parametersNode: ParametersNode,
  actionNode: ActionNode,
  outputNode: OutputNode,
};

const nodeDefaults = {
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
};

const sanitizeForRfId = (value: string) =>
  value.replace(/[^a-zA-Z0-9-_.:]/g, "_");

const buildRfId = (step: TaskStep | undefined, index: number) => {
  if (step && typeof step.id === "string" && step.id.trim().length > 0) {
    return `rf-${sanitizeForRfId(step.id)}-${index}`;
  }
  return `rf-${index + 1}`;
};

const cloneStep = (step: TaskStep): TaskStep =>
  JSON.parse(JSON.stringify(step ?? {})) as TaskStep;

const cloneOutput = (
  output: ScaffolderTaskOutput | undefined | null
): ScaffolderTaskOutput =>
  JSON.parse(JSON.stringify(output ?? {})) as ScaffolderTaskOutput;

const cloneParameters = (
  parameters: TemplateParametersValue
): TemplateParametersValue =>
  parameters === undefined
    ? undefined
    : (JSON.parse(JSON.stringify(parameters)) as TemplateParametersValue);

const resolveNodeHeightForTracking = (node: Node): number | undefined => {
  const measuredHeight = node.measured?.height;
  if (typeof measuredHeight === "number" && measuredHeight > 0) {
    return measuredHeight;
  }

  const explicitHeight = node.height;
  if (typeof explicitHeight === "number" && explicitHeight > 0) {
    return explicitHeight;
  }

  return undefined;
};

type BuildNodesFromModelOptions = {
  scaffolderActionIds: string[];
  scaffolderActionInputsById: Record<string, Record<string, unknown>>;
  scaffolderActionOutputsById: Record<string, Record<string, unknown>>;
};

const buildNodesFromModel = (
  steps: TaskStep[],
  parameters: TemplateParametersValue,
  output: ScaffolderTaskOutput | undefined | null,
  options: BuildNodesFromModelOptions
) => {
  const {
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
  } = options;

  const parameterSections = normalizeParametersToSections(parameters);
  const nodes: Node[] = [];

  const rfParametersId = "rf-parameters";
  nodes.push({
    id: rfParametersId,
    type: "parametersNode",
    position: { x: FIXED_X_POSITION, y: 0 },
    data: {
      rfId: rfParametersId,
      parameters: cloneParameters(parameters),
      sections: parameterSections,
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
    },
    ...nodeDefaults,
  });

  const actionNodes = steps.map((step, index) => {
    const rfId = buildRfId(step, index);
    return {
      id: rfId,
      type: "actionNode",
      position: { x: FIXED_X_POSITION, y: 0 },
      data: {
        rfId,
        step: cloneStep(step),
        scaffolderActionIds,
        scaffolderActionInputsById,
        scaffolderActionOutputsById,
      },
      ...nodeDefaults,
    } as Node;
  });

  nodes.push(...actionNodes);

  if (output !== undefined && output !== null) {
    const rfOutputId = "rf-output";
    nodes.push({
      id: rfOutputId,
      type: "outputNode",
      position: { x: FIXED_X_POSITION, y: 0 },
      data: {
        rfId: rfOutputId,
        output: cloneOutput(output),
        scaffolderActionIds,
        scaffolderActionInputsById,
        scaffolderActionOutputsById,
      },
      ...nodeDefaults,
    });
  }

  return alignNodes(nodes, FIXED_X_POSITION, VERTICAL_SPACING);
};

const collectParameterReferences = (
  parameters: TemplateParametersValue
): string[] => {
  const refs = new Set<string>();

  const extractProperties = (schema: unknown) => {
    if (!schema || typeof schema !== "object") {
      return;
    }

    const record = schema as Record<string, unknown>;
    if (record.properties && typeof record.properties === "object") {
      Object.keys(record.properties as Record<string, unknown>).forEach(
        (key) => {
          if (key) {
            refs.add(`\${{ parameters.${key} }}`);
          }
        }
      );
    }

    if (Array.isArray(record.steps)) {
      record.steps.forEach((stepSchema) => {
        if (!stepSchema || typeof stepSchema !== "object") {
          return;
        }
        extractProperties((stepSchema as Record<string, unknown>).schema);
      });
    }
  };

  if (Array.isArray(parameters)) {
    parameters.forEach((item) => extractProperties(item));
  } else {
    extractProperties(parameters);
  }

  return Array.from(refs).sort();
};

const normalizeValueForStableStringify = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeValueForStableStringify);
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== undefined)
      // eslint-disable-next-line no-nested-ternary
      .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0));
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = normalizeValueForStableStringify(val);
      return acc;
    }, {});
  }
  return value;
};

const stableStringify = (value: unknown): string =>
  JSON.stringify(normalizeValueForStableStringify(value));

type ScaffolderAction = {
  id: string;
  schema?: {
    input?: {
      properties?: Record<string, unknown>;
    };
    output?: {
      properties?: Record<string, unknown>;
    };
  };
};

const buildScaffolderActionsCache = (list: ScaffolderAction[]) => {
  const { inputsById, outputsById } = list.reduce<{
    inputsById: Record<string, Record<string, unknown>>;
    outputsById: Record<string, Record<string, unknown>>;
  }>(
    (acc, action) => {
      acc.inputsById[action.id] = action.schema?.input?.properties ?? {};
      acc.outputsById[action.id] = action.schema?.output?.properties ?? {};
      return acc;
    },
    { inputsById: {}, outputsById: {} }
  );

  return {
    ids: list.map((action) => action.id),
    inputsById,
    outputsById,
  };
};

const useScaffolderActions = () => {
  const scaffolderApi = useApi(scaffolderApiRef);
  const [cache, setCache] = useState(() => buildScaffolderActionsCache([]));

  useEffect(() => {
    let cancelled = false;

    scaffolderApi
      .listActions()
      .then((remoteActions) => {
        if (cancelled) {
          return;
        }
        setCache(buildScaffolderActionsCache(remoteActions));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [scaffolderApi]);

  return cache;
};

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
        }
      ),
    [
      steps,
      normalizedParametersProp,
      normalizedOutputProp,
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
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
      }),
    [
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
    ]
  );

  const lastAppliedModelHashRef = useRef<string | null>(null);
  const lastEmittedModelHashRef = useRef<string | null>(null);
  const skipNextModelHashRef = useRef<string | null>(null);
  const lastCacheFingerprintRef = useRef<string | null>(null);
  const nodeHeightsRef = useRef<Record<string, number>>({});

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
      }
    );

    lastAppliedModelHashRef.current = modelHash;
    lastCacheFingerprintRef.current = cacheFingerprint;
    lastEmittedModelHashRef.current = modelHash;

    setNodes(nextNodes);
    setEdges(createSequentialEdges(nextNodes));
  }, [
    steps,
    normalizedParametersProp,
    normalizedOutputProp,
    modelHash,
    cacheFingerprint,
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
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
        scaffolderActionOutputsById,
      }),
    [
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
      setNodes,
      setEdges,
    ]
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
      onUpdateField,
      onUpdateInput,
      onRemoveInputKey,
      onUpdateOutput,
      onUpdateSections,
      stepOutputReferencesByNode,
    ]
  );

  const stepsFromNodes = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
    return sorted
      .map((node) => {
        const data = node.data as ActionNodeData | undefined;
        if (!data || !data.step) {
          return undefined;
        }
        return cloneStep(data.step as TaskStep);
      })
      .filter((step): step is TaskStep => !!step);
  }, [nodes]);

  const parametersFromNodes = useMemo(() => {
    const parametersNode = [...nodes]
      .sort((a, b) => a.position.y - b.position.y)
      .find((node) => node.type === "parametersNode");
    if (!parametersNode) {
      return undefined;
    }
    const data = parametersNode.data as ParametersNodeData | undefined;
    if (!data) {
      return undefined;
    }
    return cloneParameters(data.parameters);
  }, [nodes]);

  const outputFromNodes = useMemo(() => {
    const outputNode = [...nodes]
      .sort((a, b) => a.position.y - b.position.y)
      .find((node) => node.type === "outputNode");
    if (!outputNode) {
      return undefined;
    }
    const data = outputNode.data as OutputNodeData | undefined;
    if (!data) {
      return undefined;
    }
    return cloneOutput(data.output);
  }, [nodes]);

  const normalizedOutputFromNodes = outputFromNodes ?? null;

  useEffect(() => {
    if (!onStepsChange && !onParametersChange && !onOutputChange) {
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
  }, [
    stepsFromNodes,
    parametersFromNodes,
    normalizedOutputFromNodes,
    outputFromNodes,
    onStepsChange,
    onParametersChange,
    onOutputChange,
  ]);

  const fitViewOptions = useMemo(() => ({ padding: 0.2, duration: 300 }), []);
  const [reactFlowInstance] = useState<ReactFlowInstance | null>(null);

  const fitFlowToView = useCallback(() => {
    if (!reactFlowInstance) {
      return;
    }
    reactFlowInstance.fitView(fitViewOptions);
  }, [fitViewOptions, reactFlowInstance]);

  useEffect(() => {
    fitFlowToView();
  }, [fitFlowToView, nodes, edges]);

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
        fitViewOptions={fitViewOptions}
      >
        <Panel
          position="bottom-right"
          style={{
            maxHeight: "60vh",
            width: 320,
            overflow: "auto",
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 2px 10px rgba(0, 0, 0, 0.12)",
            padding: "12px 16px",
            fontFamily: "monospace",
            fontSize: "0.75rem",
            lineHeight: 1.4,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
          }}
        >
          <pre style={{ margin: 0 }}>
            {JSON.stringify(stepOutputReferencesByNode, null, 2)}
          </pre>
        </Panel>
      </ReactFlow>
    </div>
  );
}
