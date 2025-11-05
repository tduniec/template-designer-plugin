import type { Dispatch, SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { TaskStep } from "@backstage/plugin-scaffolder-common";
import type {
  ActionNodeData,
  AddNodeConfig,
  DesignerNodeType,
  OutputNodeData,
} from "../../nodes/types";
import { createSequentialEdges } from "../../utils/createSequentialEdges";

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
  options: CreateHandleAddNodeOptions
) => {
  const {
    fixedXPosition,
    verticalSpacing,
    nodeDefaults,
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
  } = options;

  return (config: AddNodeConfig) => {
    const {
      afterRfId,
      type = "actionNode",
      stepTemplate,
      outputTemplate,
    } = config;
    const nodeType: DesignerNodeType = type;

    const alignNodes = (nodes: Node[]) =>
      nodes.map((node, index) => ({
        ...node,
        position: {
          x: fixedXPosition,
          y: index * verticalSpacing,
        },
      }));

    setNodes((nodes) => {
      const actionNodes = nodes.filter((n) => n.type !== "outputNode");
      const outputNodes = nodes.filter((n) => n.type === "outputNode");

      if (nodeType === "outputNode") {
        if (outputNodes.length > 0) {
          return alignNodes([...actionNodes, ...outputNodes]);
        }

        const initialOutput =
          outputTemplate !== null && outputTemplate !== undefined
            ? (JSON.parse(JSON.stringify(outputTemplate)) as Record<
                string,
                unknown
              >)
            : {};
        const rfOutputId = "rf-output";

        const outputNode: Node = {
          id: rfOutputId,
          type: "outputNode",
          position: { x: fixedXPosition, y: 0 },
          data: {
            rfId: rfOutputId,
            output: initialOutput,
            scaffolderActionIds,
            scaffolderActionInputsById,
            scaffolderActionOutputsById,
          },
          ...nodeDefaults,
        };

        const next = [...actionNodes, outputNode, ...outputNodes];
        const aligned = alignNodes(next);
        setEdges(createSequentialEdges(aligned));
        return aligned;
      }

      const parentIndex = actionNodes.findIndex((n) => n.id === afterRfId);
      const insertIndex =
        parentIndex >= 0 ? parentIndex + 1 : actionNodes.length;

      const rfId = `rf-${Date.now()}`;
      const stepDefaults: TaskStep = {
        id: `step-${rfId}`,
        name: "New Step",
        action: "",
        input: {},
      };

      const newStep: TaskStep = {
        ...stepDefaults,
        ...(stepTemplate ?? {}),
      };

      const newNode: Node = {
        id: rfId,
        type: "actionNode",
        position: { x: fixedXPosition, y: 0 },
        data: {
          rfId,
          step: newStep,
          scaffolderActionIds,
          scaffolderActionInputsById,
          scaffolderActionOutputsById,
        },
        ...nodeDefaults,
      };

      const nextActionNodes = [
        ...actionNodes.slice(0, insertIndex),
        newNode,
        ...actionNodes.slice(insertIndex),
      ];

      const next = [...nextActionNodes, ...outputNodes];
      const aligned = alignNodes(next);
      setEdges(createSequentialEdges(aligned));
      return aligned;
    });
  };
};

export const createHandleRemoveInputKey = (setNodes: SetNodes) => {
  return (rfId: string, key: string) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== rfId) {
          return n;
        }

        const data = n.data as Partial<ActionNodeData>;
        if (!data.step) {
          return n;
        }
        const nextInput = { ...(data.step.input ?? {}) };
        delete nextInput[key];
        const step = { ...data.step, input: nextInput };

        return { ...n, data: { ...data, step } };
      })
    );
  };
};

export const createHandleReorderAndAlignNodes = (
  setNodes: SetNodes,
  setEdges: SetEdges,
  options: { fixedXPosition: number; verticalSpacing: number }
) => {
  const { fixedXPosition, verticalSpacing } = options;

  return (updatedNode: Node) => {
    setNodes((prevNodes) => {
      const updatedNodes = prevNodes.map((node) =>
        node.id === updatedNode.id ? updatedNode : node
      );

      const actionNodes = updatedNodes
        .filter((node) => node.type !== "outputNode")
        .sort((a, b) => a.position.y - b.position.y);
      const outputNodes = updatedNodes
        .filter((node) => node.type === "outputNode")
        .sort((a, b) => a.position.y - b.position.y);

      const reordered = [...actionNodes, ...outputNodes];

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
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== rfId) {
          return n;
        }

        const data = n.data as Partial<ActionNodeData>;
        if (!data.step) {
          return n;
        }
        const step = { ...data.step, [field]: value };

        return { ...n, data: { ...data, step } };
      })
    );
  };
};

export const createHandleUpdateInput = (setNodes: SetNodes) => {
  return (rfId: string, key: string, value: unknown) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== rfId) {
          return n;
        }

        const data = n.data as Partial<ActionNodeData>;
        if (!data.step) {
          return n;
        }
        const nextInput = { ...(data.step.input ?? {}), [key]: value };
        const step = { ...data.step, input: nextInput };

        return { ...n, data: { ...data, step } };
      })
    );
  };
};

export const collectStepOutputReferences = (
  nodes: Node[]
): Record<string, string[]> => {
  const referencesByNode: Record<string, string[]> = {};
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const accumulatedReferences: string[] = [];
  const accumulatedSet = new Set<string>();

  sortedNodes.forEach((node) => {
    referencesByNode[node.id] = [...accumulatedReferences];

    const data = node.data as Partial<ActionNodeData> | undefined;
    if (!data || !data.step) {
      return;
    }

    const { step, scaffolderActionOutputsById } = data;
    const stepId =
      step && typeof step.id === "string" && step.id.trim().length > 0
        ? step.id
        : null;
    const actionId =
      step && typeof step.action === "string" && step.action.trim().length > 0
        ? step.action
        : null;

    if (!stepId || !actionId) {
      return;
    }

    const outputKeys = new Set<string>();
    const schemaOutputs = scaffolderActionOutputsById?.[actionId];
    if (schemaOutputs && typeof schemaOutputs === "object") {
      Object.keys(schemaOutputs).forEach((key) => {
        if (key) {
          outputKeys.add(key);
        }
      });
    }

    const stepOutput = (step as { output?: Record<string, unknown> }).output;
    if (stepOutput && typeof stepOutput === "object") {
      Object.keys(stepOutput).forEach((key) => {
        if (key) {
          outputKeys.add(key);
        }
      });
    }

    outputKeys.forEach((outputKey) => {
      const reference = `$\{\{ steps[${stepId}].output.${outputKey} }}`;
      if (!accumulatedSet.has(reference)) {
        accumulatedSet.add(reference);
        accumulatedReferences.push(reference);
      }
    });
  });

  return referencesByNode;
};

export const createHandleUpdateOutput = (setNodes: SetNodes) => {
  return (
    rfId: string,
    updater: (prev: OutputNodeData["output"]) => OutputNodeData["output"]
  ) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== rfId || node.type !== "outputNode") {
          return node;
        }
        const data = node.data as OutputNodeData;
        const nextOutput = updater(data.output ?? {});
        return {
          ...node,
          data: {
            ...data,
            output: nextOutput,
          },
        };
      })
    );
  };
};
