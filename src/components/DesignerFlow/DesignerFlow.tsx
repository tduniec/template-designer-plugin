import { useCallback, useEffect, useMemo, useState } from 'react';
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
import initialStepsYaml from '../../utils/initialNodes1.yaml';
import { convertYamlToJson } from '../../utils/yamlJsonConversion';
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

const initialSteps = JSON.parse(
  convertYamlToJson(initialStepsYaml),
) as TaskStep[];

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
  const [cache, setCache] = useState(() =>
    buildScaffolderActionsCache(([]) ),
  );

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
      .catch(error => {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to load scaffolder actions', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scaffolderApi]);

  return cache;
};

type DesignerFlowProps = {
  onNodesJsonChange?: (json: string) => void;
};

export default function App({ onNodesJsonChange }: DesignerFlowProps) {
  const scaffolderActionsCache = useScaffolderActions();

  const {
    ids: scaffolderActionIds,
    inputsById: scaffolderActionInputsById,
    outputsById: scaffolderActionOutputsById,
  } = scaffolderActionsCache;

  // Build initial nodes ONCE, with a stable RF id separate from step.id
  const initialNodes: Node[] = useMemo(
    () =>
      initialSteps.map((step, index) => {
        const rfId = `rf-${index + 1}`;
        return {
          id: rfId, // ReactFlow id (stable, never tied to step.id)
          type: 'actionNode',
          position: { x: FIXED_X_POSITION, y: index * VERTICAL_SPACING },
          data: {
            rfId,
            step,
            scaffolderActionIds,
            scaffolderActionInputsById,
            scaffolderActionOutputsById,
          }, // pass rfId + the TaskStep payload
          ...nodeDefaults,
        } as Node;
      }),
    [
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionOutputsById,
    ],
  );

  const [nodes, setNodes] = useNodesState(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(
    createSequentialEdges(initialNodes),
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
        },
      })),
    [nodes, handleAddNode, onUpdateField, onUpdateInput, onRemoveInputKey],
  );

  const nodesPreview = useMemo(
    () =>
      nodes.map(node => {
        const { id, position, data } = node;
        const { step } = (data as ActionNodeData) ?? {};
        return {
          id,
          position,
          step,
        };
      }),
    [nodes],
  );

  const nodesJson = useMemo(
    () => JSON.stringify(nodesPreview, null, 2),
    [nodesPreview],
  );

  useEffect(() => {
    if (!onNodesJsonChange) {
      return;
    }
    onNodesJsonChange(nodesJson);
  }, [nodesJson, onNodesJsonChange]);

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
          <pre style={{ margin: 0 }}>{collectStepOutputReferences(nodes)}</pre>
        </Panel>
      </ReactFlow>
    </div>
  );
}

// fetch("https://backstage.app.trading-point.com/api/scaffolder/v2/actions", {
//   "headers": {
//   },
//   "body": null,
//   "method": "GET"
// });
