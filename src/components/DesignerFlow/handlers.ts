import type { Dispatch, SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { TaskStep } from "@backstage/plugin-scaffolder-common";
import type {
  ActionNodeData,
  AddNodeConfig,
  DesignerNodeType,
  OutputNodeData,
  ParametersNodeData,
  TemplateParametersValue,
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

const orderNodes = (
  parameterNodes: Node[],
  actionNodes: Node[],
  outputNodes: Node[]
) => [...parameterNodes, ...actionNodes, ...outputNodes];

const DEFAULT_NODE_HEIGHT = 320;
const MIN_VERTICAL_GAP = 48;

const parseNumericHeight = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (!Number.isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return null;
};

const getNodeHeight = (node: Node): number => {
  const measured = parseNumericHeight(node.measured?.height);
  if (measured) {
    return measured;
  }
  const explicitHeight = parseNumericHeight(node.height);
  if (explicitHeight) {
    return explicitHeight;
  }
  const styleHeight = parseNumericHeight(node.style?.height);
  if (styleHeight) {
    return styleHeight;
  }
  return DEFAULT_NODE_HEIGHT;
};

export const alignNodes = (
  nodes: Node[],
  fixedXPosition: number,
  verticalSpacing: number
) => {
  let currentY = 0;

  return nodes.map((node) => {
    const alignedNode: Node = {
      ...node,
      position: {
        x: fixedXPosition,
        y: currentY,
      },
    };

    const nodeHeight = getNodeHeight(node);
    const distanceToNext = Math.max(nodeHeight + MIN_VERTICAL_GAP, verticalSpacing);
    currentY += distanceToNext;

    return alignedNode;
  });
};

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
      parametersTemplate,
    } = config;
    const nodeType: DesignerNodeType = type;

    setNodes((nodes) => {
      const parameterNodes = nodes.filter((n) => n.type === "parametersNode");
      const actionNodes = nodes.filter((n) => n.type === "actionNode");
      const outputNodes = nodes.filter((n) => n.type === "outputNode");

      const composeAndAlign = (
        nextParameters: Node[],
        nextActions: Node[],
        nextOutputs: Node[]
      ) => {
        const ordered = orderNodes(nextParameters, nextActions, nextOutputs);
        const aligned = alignNodes(ordered, fixedXPosition, verticalSpacing);
        setEdges(createSequentialEdges(aligned));
        return aligned;
      };

      if (nodeType === "parametersNode") {
        if (parameterNodes.length > 0) {
          return composeAndAlign(parameterNodes, actionNodes, outputNodes);
        }

        const rfParametersId = "rf-parameters";
        const initialParameters =
          parametersTemplate !== undefined
            ? (JSON.parse(
                JSON.stringify(parametersTemplate)
              ) as TemplateParametersValue)
            : undefined;

        const parameterNode: Node = {
          id: rfParametersId,
          type: "parametersNode",
          position: { x: fixedXPosition, y: 0 },
          data: {
            rfId: rfParametersId,
            parameters: initialParameters,
            scaffolderActionIds,
            scaffolderActionInputsById,
            scaffolderActionOutputsById,
          } satisfies ParametersNodeData,
          ...nodeDefaults,
        };

        return composeAndAlign([parameterNode], actionNodes, outputNodes);
      }

      if (nodeType === "outputNode") {
        if (outputNodes.length > 0) {
          return composeAndAlign(parameterNodes, actionNodes, outputNodes);
        }

        const rfOutputId = "rf-output";
        const initialOutput =
          outputTemplate !== undefined && outputTemplate !== null
            ? (JSON.parse(JSON.stringify(outputTemplate)) as Record<
                string,
                unknown
              >)
            : {};

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

        return composeAndAlign(parameterNodes, actionNodes, [
          ...outputNodes,
          outputNode,
        ]);
      }

      const parametersNodeId = parameterNodes[0]?.id ?? null;
      const parentIndex = actionNodes.findIndex((n) => n.id === afterRfId);
      let insertIndex: number;
      if (parentIndex >= 0) {
        insertIndex = parentIndex + 1;
      } else if (afterRfId === parametersNodeId) {
        insertIndex = 0;
      } else {
        insertIndex = actionNodes.length;
      }

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

      return composeAndAlign(parameterNodes, nextActionNodes, outputNodes);
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

      const parameterNodes = updatedNodes
        .filter((node) => node.type === "parametersNode")
        .sort((a, b) => a.position.y - b.position.y);
      const actionNodes = updatedNodes
        .filter((node) => node.type === "actionNode")
        .sort((a, b) => a.position.y - b.position.y);
      const outputNodes = updatedNodes
        .filter((node) => node.type === "outputNode")
        .sort((a, b) => a.position.y - b.position.y);

      const ordered = orderNodes(parameterNodes, actionNodes, outputNodes);
      const aligned = alignNodes(ordered, fixedXPosition, verticalSpacing);

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
  nodes: Node[],
  parameterReferences: string[]
): Record<string, string[]> => {
  const referencesByNode: Record<string, string[]> = {};
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const accumulatedReferences: string[] = [...parameterReferences];
  const accumulatedSet = new Set<string>(parameterReferences);

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
      const reference = `\${{ steps['${stepId}'].output.${outputKey} }}`;
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

export const createHandleUpdateParameters = (setNodes: SetNodes) => {
  return (
    rfId: string,
    updater: (prev: TemplateParametersValue) => TemplateParametersValue
  ) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== rfId || node.type !== "parametersNode") {
          return node;
        }
        const data = node.data as ParametersNodeData;
        const nextParameters = updater(data.parameters);
        return {
          ...node,
          data: {
            ...data,
            parameters: nextParameters,
          },
        };
      })
    );
  };
};
