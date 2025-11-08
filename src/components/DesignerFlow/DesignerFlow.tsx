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
  TemplateParameterSchema,
  TemplateParametersV1beta3,
} from "@backstage/plugin-scaffolder-common";
import { ActionNode } from "../../nodes/ActionNode";
import { ParametersNode } from "../../nodes/ParametersNode";
import { ParameterTitlesNode } from "../../nodes/ParameterTitlesNode";
import { ParameterInputNode } from "../../nodes/ParameterInputNode";
import { OutputNode } from "../../nodes/OutputNode";
import type {
  ActionNodeData,
  OutputNodeData,
  ParametersNodeData,
  ParameterInputNodeData,
  ParameterSectionDisplay,
  ParameterTitlesNodeData,
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
  createHandleUpdateParameters,
} from "./handlers";
import { scaffolderApiRef } from "@backstage/plugin-scaffolder-react";
import { useApi } from "@backstage/core-plugin-api";

const VERTICAL_SPACING = 400;
const FIXED_X_POSITION = 100;

const nodeTypes = {
  parametersNode: ParametersNode,
  parameterTitlesNode: ParameterTitlesNode,
  parameterInputNode: ParameterInputNode,
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

type ParameterSection = ParameterSectionDisplay;

type ParameterFieldSummary = {
  id: string;
  fieldName: string;
  sectionTitle?: string;
  required: boolean;
  schema?: TemplateParameterSchema;
};

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : undefined;

const asSchemaRecord = (
  value: unknown
): Record<string, TemplateParameterSchema> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, TemplateParameterSchema>;
};

const normalizeParametersToSections = (
  parameters: TemplateParametersValue
): ParameterSection[] => {
  if (parameters === undefined || parameters === null) {
    return [];
  }

  const entries = Array.isArray(parameters) ? parameters : [parameters];
  const sections: ParameterSection[] = [];

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const record = entry as Record<string, any>;
    const steps = Array.isArray(record.steps) ? record.steps : [];
    if (steps.length > 0) {
      steps.forEach((step, stepIndex) => {
        if (!step || typeof step !== "object") {
          return;
        }
        const schema = (step as Record<string, any>).schema;
        if (!schema || typeof schema !== "object") {
          return;
        }
        const sectionSchema = schema as TemplateParametersV1beta3;
        const stepRecord = step as Record<string, any>;
        const sectionTitle =
          asString(stepRecord.title) ??
          asString(sectionSchema.title) ??
          `Step ${stepIndex + 1}`;
        const sectionDescription =
          asString(stepRecord.description) ??
          asString(sectionSchema.description);
        const properties = asSchemaRecord(sectionSchema.properties) ?? {};
        const required = asStringArray(sectionSchema.required) ?? [];
        sections.push({
          id: `section-${index}-step-${stepIndex}`,
          title: sectionTitle,
          description: sectionDescription,
          properties,
          required,
        });
      });
      return;
    }

    const schema = record as TemplateParametersV1beta3;
    const schemaTitle = asString(schema.title);
    const schemaDescription = asString(schema.description);
    const properties = asSchemaRecord(schema.properties);

    if (properties && Object.keys(properties).length > 0) {
      sections.push({
        id: `section-${index}`,
        title: schemaTitle ?? `Section ${index + 1}`,
        description: schemaDescription,
        properties,
        required: asStringArray(schema.required) ?? [],
      });
      return;
    }

    const parameterSchema = entry as TemplateParameterSchema;
    const fallbackKey = schemaTitle ?? `field-${index + 1}`;

    sections.push({
      id: `section-${index}`,
      title: schemaTitle ?? `Section ${index + 1}`,
      description: schemaDescription,
      properties: {
        [fallbackKey]: parameterSchema,
      },
      required: [],
    });
  });

  return sections;
};

const buildParameterFields = (
  sections: ParameterSection[]
): ParameterFieldSummary[] => {
  const fields: ParameterFieldSummary[] = [];

  sections.forEach((section, sectionIndex) => {
    const properties = section.properties ?? {};
    Object.entries(properties).forEach(([fieldName, schema], fieldIndex) => {
      const required =
        Array.isArray(section.required) &&
        section.required.includes(fieldName);
      fields.push({
        id: `section-${sectionIndex}-field-${fieldIndex}`,
        fieldName,
        sectionTitle: section.title,
        required: Boolean(required),
        schema,
      });
    });
  });

  return fields;
};

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
  const parameterFieldSummaries = buildParameterFields(parameterSections);
  const nodes: Node[] = [];

  const rfParametersId = "rf-parameters";
  nodes.push({
    id: rfParametersId,
    type: "parametersNode",
    position: { x: FIXED_X_POSITION, y: 0 },
    data: {
      rfId: rfParametersId,
      parameters: cloneParameters(parameters),
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
    },
    ...nodeDefaults,
  });

  const rfParameterTitlesId = "rf-parameter-titles";
  nodes.push({
    id: rfParameterTitlesId,
    type: "parameterTitlesNode",
    position: { x: FIXED_X_POSITION, y: 0 },
    data: {
      rfId: rfParameterTitlesId,
      sections: parameterSections,
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
    } satisfies ParameterTitlesNodeData,
    ...nodeDefaults,
  });

  parameterFieldSummaries.forEach((field, index) => {
    const rfParameterFieldId = `rf-parameter-field-${index}`;
    nodes.push({
      id: rfParameterFieldId,
      type: "parameterInputNode",
      position: { x: FIXED_X_POSITION, y: 0 },
      data: {
        rfId: rfParameterFieldId,
        fieldName: field.fieldName,
        sectionTitle: field.sectionTitle,
        required: field.required,
        schema: field.schema,
        scaffolderActionIds,
        scaffolderActionInputsById,
        scaffolderActionOutputsById,
      } satisfies ParameterInputNodeData,
      ...nodeDefaults,
    });
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

  const onUpdateParameters = useMemo(
    () => createHandleUpdateParameters(setNodes),
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
              onUpdateParameters,
              stepOutputReferences,
            },
          };
        }
        if (node.type === "parameterTitlesNode") {
          const data = node.data as ParameterTitlesNodeData;
          return {
            ...node,
            data: {
              ...data,
              onAddNode: handleAddNode,
              stepOutputReferences,
            },
          };
        }
        if (node.type === "parameterInputNode") {
          const data = node.data as ParameterInputNodeData;
          return {
            ...node,
            data: {
              ...data,
              onAddNode: handleAddNode,
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
      onUpdateParameters,
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
