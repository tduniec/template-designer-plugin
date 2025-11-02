import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { createSequentialEdges } from '../../utils/createSequentialEdges';
import type { TaskStep } from '@backstage/plugin-scaffolder-common';
import { ActionNode } from '../../nodes/ActionNode';
import type { ActionNodeData } from '../../nodes/ActionNode';
import {
  collectStepOutputReferences,
  createHandleAddNode,
  createHandleRemoveInputKey,
  createHandleReorderAndAlignNodes,
  createHandleUpdateField,
  createHandleUpdateInput,
} from './handlers';
import { scaffolderApiRef } from '@backstage/plugin-scaffolder-react';
import { useApi } from '@backstage/core-plugin-api';

const VERTICAL_SPACING = 400;
const FIXED_X_POSITION = 100;

const nodeTypes = {
  actionNode: ActionNode,
};

const nodeDefaults = {
  sourcePosition: Position.Bottom,
  targetPosition: Position.Top,
};

const sanitizeForRfId = (value: string) =>
  value.replace(/[^a-zA-Z0-9-_.:]/g, '_');

const buildRfId = (step: TaskStep | undefined, index: number) => {
  if (step && typeof step.id === 'string' && step.id.trim().length > 0) {
    return `rf-${sanitizeForRfId(step.id)}-${index}`;
  }
  return `rf-${index + 1}`;
};

const cloneStep = (step: TaskStep): TaskStep =>
  JSON.parse(JSON.stringify(step ?? {})) as TaskStep;

type BuildNodesFromStepsOptions = {
  scaffolderActionIds: string[];
  scaffolderActionInputsById: Record<string, Record<string, unknown>>;
  scaffolderActionOutputsById: Record<string, Record<string, unknown>>;
};

const buildNodesFromSteps = (
  steps: TaskStep[],
  options: BuildNodesFromStepsOptions,
) => {
  const {
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
  } = options;

  return steps.map((step, index) => {
    const rfId = buildRfId(step, index);
    return {
      id: rfId,
      type: 'actionNode',
      position: { x: FIXED_X_POSITION, y: index * VERTICAL_SPACING },
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
};

const normalizeValueForStableStringify = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeValueForStableStringify);
  }
  if (value && typeof value === 'object') {
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
    { inputsById: {}, outputsById: {} },
  );

  return {
    ids: list.map(action => action.id),
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
      .then(remoteActions => {
        if (cancelled) {
          return;
        }
        setCache(buildScaffolderActionsCache(remoteActions));
      })
      .catch();

    return () => {
      cancelled = true;
    };
  }, [scaffolderApi]);

  return cache;
};

type DesignerFlowProps = {
  steps?: TaskStep[];
  onStepsChange?: (steps: TaskStep[]) => void;
};

export default function App({ steps = [], onStepsChange }: DesignerFlowProps) {
  const scaffolderActionsCache = useScaffolderActions();

  const {
    ids: scaffolderActionIds,
    inputsById: scaffolderActionInputsById,
    outputsById: scaffolderActionOutputsById,
  } = scaffolderActionsCache;

  const initialNodes = useMemo(
    () =>
      buildNodesFromSteps(steps, {
        scaffolderActionIds,
        scaffolderActionInputsById,
        scaffolderActionOutputsById,
      }),
    [
      steps,
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
    ],
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(() =>
    createSequentialEdges(initialNodes),
  );

  const stepsHash = useMemo(() => stableStringify(steps), [steps]);
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
    ],
  );

  const lastAppliedStepsHashRef = useRef<string | null>(null);
  const lastEmittedStepsHashRef = useRef<string | null>(null);
  const skipNextStepsHashRef = useRef<string | null>(null);
  const lastCacheFingerprintRef = useRef<string | null>(null);

  useEffect(() => {
    const isCacheChanged = cacheFingerprint !== lastCacheFingerprintRef.current;
    const shouldSkip =
      stepsHash === skipNextStepsHashRef.current && !isCacheChanged;

    if (shouldSkip) {
      skipNextStepsHashRef.current = null;
      lastAppliedStepsHashRef.current = stepsHash;
      lastCacheFingerprintRef.current = cacheFingerprint;
      return;
    }

    if (stepsHash === lastAppliedStepsHashRef.current && !isCacheChanged) {
      return;
    }

    const nextNodes = buildNodesFromSteps(steps, {
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
    });

    lastAppliedStepsHashRef.current = stepsHash;
    lastCacheFingerprintRef.current = cacheFingerprint;
    lastEmittedStepsHashRef.current = stepsHash;

    setNodes(nextNodes);
    setEdges(createSequentialEdges(nextNodes));
  }, [
    steps,
    stepsHash,
    cacheFingerprint,
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
    setNodes,
    setEdges,
  ]);

  const stepOutputReferencesByNode = useMemo(
    () => collectStepOutputReferences(nodes),
    [nodes],
  );

  // ----- ReactFlow change handlers (keep your layout approach) -----
  const onNodesChange = useCallback(
    (changes: NodeChange<Node>[]) =>
      setNodes(ns => applyNodeChanges(changes, ns)),
    [setNodes],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange<Edge>[]) =>
      setEdges(es => applyEdgeChanges(changes, es)),
    [setEdges],
  );

  const onConnect = useCallback(
    (params: any) => setEdges(es => addEdge(params, es)),
    [setEdges],
  );

  const reorderAndAlignNodes = useMemo(
    () =>
      createHandleReorderAndAlignNodes(setNodes, setEdges, {
        fixedXPosition: FIXED_X_POSITION,
        verticalSpacing: VERTICAL_SPACING,
      }),
    [setNodes, setEdges],
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      reorderAndAlignNodes(node);
    },
    [reorderAndAlignNodes],
  );

  const onUpdateField = useMemo(
    () => createHandleUpdateField(setNodes),
    [setNodes],
  );

  const onUpdateInput = useMemo(
    () => createHandleUpdateInput(setNodes),
    [setNodes],
  );

  const onRemoveInputKey = useMemo(
    () => createHandleRemoveInputKey(setNodes),
    [setNodes],
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
    ],
  );

  // Attach callbacks to each node’s data
  const nodesWithHandlers = useMemo(
    () =>
      nodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onAddNode: handleAddNode,
          onUpdateField,
          onUpdateInput,
          onRemoveInputKey,
          stepOutputReferences: stepOutputReferencesByNode[node.id] ?? [],
        },
      })),
    [
      nodes,
      handleAddNode,
      onUpdateField,
      onUpdateInput,
      onRemoveInputKey,
      stepOutputReferencesByNode,
    ],
  );

  const stepsFromNodes = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => a.position.y - b.position.y);
    return sorted
      .map(node => {
        const data = node.data as ActionNodeData | undefined;
        if (!data || !data.step) {
          return undefined;
        }
        return cloneStep(data.step as TaskStep);
      })
      .filter((step): step is TaskStep => !!step);
  }, [nodes]);

  useEffect(() => {
    if (!onStepsChange) {
      return;
    }
    const serialized = stableStringify(stepsFromNodes);
    if (serialized === lastEmittedStepsHashRef.current) {
      return;
    }
    lastEmittedStepsHashRef.current = serialized;
    skipNextStepsHashRef.current = serialized;
    onStepsChange(stepsFromNodes);
  }, [stepsFromNodes, onStepsChange]);

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
      return undefined; // 👈 explicitly returning undefined
    }
    window.addEventListener('resize', fitFlowToView);
    return () => {
      window.removeEventListener('resize', fitFlowToView);
    };
  }, [fitFlowToView, reactFlowInstance]);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: '70vh' }}>
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
            maxHeight: '60vh',
            width: 320,
            overflow: 'auto',
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.12)',
            padding: '12px 16px',
            fontFamily: 'monospace',
            fontSize: '0.75rem',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
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