import type { Dispatch, SetStateAction } from 'react';
import type { Edge, Node } from '@xyflow/react';
import type { TaskStep } from '@backstage/plugin-scaffolder-common';
import type { ActionNodeData } from '../../nodes/ActionNode';
import { createSequentialEdges } from '../../utils/createSequentialEdges';

type SetNodes = Dispatch<SetStateAction<Node[]>>;
type SetEdges = Dispatch<SetStateAction<Edge[]>>;

interface CreateHandleAddNodeOptions {
  fixedXPosition: number;
  verticalSpacing: number;
  nodeDefaults: Partial<Node>;
  scaffolderActionIds: string[];
  scaffolderActionInputsById: Record<string, Record<string, unknown>>;
  scaffolderActionOutputsById: Record<string, Record<string, unknown>>;
}

export const createHandleAddNode = (
  setNodes: SetNodes,
  setEdges: SetEdges,
  options: CreateHandleAddNodeOptions,
) => {
  const {
    fixedXPosition,
    verticalSpacing,
    nodeDefaults,
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
  } = options;

  return (afterRfId: string) => {
    setNodes(nds => {
      const parentIndex = nds.findIndex(n => n.id === afterRfId);
      if (parentIndex === -1) {
        return nds;
      }

      const rfId = `rf-${Date.now()}`;
      const newStep: TaskStep = {
        id: `step-${rfId}`,
        name: 'New Step',
        action: '',
        input: {},
      };

      const newNode: Node = {
        id: rfId,
        type: 'actionNode',
        position: {
          x: fixedXPosition,
          y: (parentIndex + 1) * verticalSpacing,
        },
        data: {
          rfId,
          step: newStep,
          scaffolderActionIds,
          scaffolderActionInputsById,
          scaffolderActionOutputsById,
        },
        ...nodeDefaults,
      };

      const realigned = [
        ...nds.slice(0, parentIndex + 1),
        newNode,
        ...nds.slice(parentIndex + 1),
      ].map((node, index) => ({
        ...node,
        position: {
          x: fixedXPosition,
          y: index * verticalSpacing,
        },
      }));

      setEdges(createSequentialEdges(realigned));
      return realigned;
    });
  };
};

export const createHandleRemoveInputKey = (setNodes: SetNodes) => {
  return (rfId: string, key: string) => {
    setNodes(nds =>
      nds.map(n => {
        if (n.id !== rfId) {
          return n;
        }

        const data = n.data as ActionNodeData;
        const nextInput = { ...(data.step.input ?? {}) };
        delete nextInput[key];
        const step = { ...data.step, input: nextInput };

        return { ...n, data: { ...data, step } };
      }),
    );
  };
};

export const createHandleReorderAndAlignNodes = (
  setNodes: SetNodes,
  setEdges: SetEdges,
  options: { fixedXPosition: number; verticalSpacing: number },
) => {
  const { fixedXPosition, verticalSpacing } = options;

  return (updatedNode: Node) => {
    setNodes(prevNodes => {
      const updatedNodes = prevNodes.map(node =>
        node.id === updatedNode.id ? updatedNode : node,
      );

      const reordered = [...updatedNodes].sort(
        (a, b) => a.position.y - b.position.y,
      );

      const aligned = reordered.map((node, index) => ({
        ...node,
        position: { x: fixedXPosition, y: index * verticalSpacing },
      }));

      setEdges(createSequentialEdges(aligned));
      return aligned;
    });
  };
};

export const createHandleUpdateField = (setNodes: SetNodes) => {
  return (rfId: string, field: keyof TaskStep, value: string) => {
    setNodes(nds =>
      nds.map(n => {
        if (n.id !== rfId) {
          return n;
        }

        const data = n.data as ActionNodeData;
        const step = { ...data.step, [field]: value };

        return { ...n, data: { ...data, step } };
      }),
    );
  };
};

export const createHandleUpdateInput = (setNodes: SetNodes) => {
  return (rfId: string, key: string, value: unknown) => {
    setNodes(nds =>
      nds.map(n => {
        if (n.id !== rfId) {
          return n;
        }

        const data = n.data as ActionNodeData;
        const nextInput = { ...(data.step.input ?? {}), [key]: value };
        const step = { ...data.step, input: nextInput };

        return { ...n, data: { ...data, step } };
      }),
    );
  };
};

export const collectStepOutputReferences = (
  nodes: Node[],
): Record<string, string[]> => {
  const referencesByNode: Record<string, string[]> = {};
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const accumulatedReferences: string[] = [];
  const accumulatedSet = new Set<string>();

  sortedNodes.forEach(node => {
    referencesByNode[node.id] = [...accumulatedReferences];

    const data = node.data as ActionNodeData | undefined;
    if (!data) {
      return;
    }

    const { step, scaffolderActionOutputsById } = data;
    const stepId =
      step && typeof step.id === 'string' && step.id.trim().length > 0
        ? step.id
        : null;
    const actionId =
      step && typeof step.action === 'string' && step.action.trim().length > 0
        ? step.action
        : null;

    if (!stepId || !actionId) {
      return;
    }

    const outputKeys = new Set<string>();
    const schemaOutputs = scaffolderActionOutputsById?.[actionId];
    if (schemaOutputs && typeof schemaOutputs === 'object') {
      Object.keys(schemaOutputs).forEach(key => {
        if (key) {
          outputKeys.add(key);
        }
      });
    }

    const stepOutput = (step as { output?: Record<string, unknown> }).output;
    if (stepOutput && typeof stepOutput === 'object') {
      Object.keys(stepOutput).forEach(key => {
        if (key) {
          outputKeys.add(key);
        }
      });
    }

    outputKeys.forEach(outputKey => {
      const reference = `steps[${stepId}].output.${outputKey}`;
      if (!accumulatedSet.has(reference)) {
        accumulatedSet.add(reference);
        accumulatedReferences.push(reference);
      }
    });
  });

  return referencesByNode;
};
