import type { Dispatch, SetStateAction } from "react";
import type { Edge, Node } from "@xyflow/react";
import type {
  ScaffolderTaskOutput,
  TaskStep,
} from "@backstage/plugin-scaffolder-common";
import type { JsonValue } from "@backstage/types";
import type {
  ActionNodeData,
  AddNodeConfig,
  DesignerNodeType,
  OutputNodeData,
  ParametersNodeData,
  ParameterSectionDisplay,
  TemplateParametersValue,
} from "../types/flowNodes";
import { createSequentialEdges } from "../utils/createSequentialEdges";
import {
  normalizeParametersToSections,
  sectionsToParametersValue,
} from "./parameterTransforms";
import { alignNodes } from "./nodeLayout";

type SetNodes = Dispatch<SetStateAction<Node[]>>;
type SetEdges = Dispatch<SetStateAction<Edge[]>>;

interface CreateHandleAddNodeOptions {
  fixedXPosition: number;
  verticalSpacing: number;
  nodeDefaults: Partial<Node>;
  scaffolderActionIds: string[];
  scaffolderActionInputsById: Record<string, Record<string, unknown>>;
  scaffolderActionInputRequiredById: Record<string, string[]>;
  scaffolderActionOutputsById: Record<string, Record<string, unknown>>;
}

interface CreateHandleRemoveNodeOptions {
  fixedXPosition: number;
  verticalSpacing: number;
}

const orderNodes = (
  parameterNodes: Node[],
  actionNodes: Node[],
  outputNodes: Node[]
) => [...parameterNodes, ...actionNodes, ...outputNodes];

const setSequentialEdgesIfChanged = (
  setEdges: SetEdges,
  alignedNodes: Node[]
) => {
  setEdges((prevEdges) => {
    const nextEdges = createSequentialEdges(alignedNodes);
    if (
      prevEdges.length === nextEdges.length &&
      prevEdges.every(
        (edge, index) =>
          edge.source === nextEdges[index]?.source &&
          edge.target === nextEdges[index]?.target
      )
    ) {
      return prevEdges;
    }
    return nextEdges;
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
    scaffolderActionInputRequiredById,
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
        setSequentialEdgesIfChanged(setEdges, aligned);
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

        return composeAndAlign(
          [
            {
              id: rfParametersId,
              type: "parametersNode",
              position: { x: fixedXPosition, y: 0 },
              data: {
                rfId: rfParametersId,
                parameters: initialParameters,
                sections:
                  initialParameters !== undefined
                    ? normalizeParametersToSections(initialParameters)
                    : [],
                scaffolderActionIds,
                scaffolderActionInputsById,
                scaffolderActionInputRequiredById,
                scaffolderActionOutputsById,
              },
              ...nodeDefaults,
            },
          ],
          actionNodes,
          outputNodes
        );
      }

      if (nodeType === "outputNode") {
        if (outputNodes.length > 0) {
          return composeAndAlign(parameterNodes, actionNodes, outputNodes);
        }

        const rfOutputId = "rf-output";
        const initialOutput = outputTemplate
          ? (JSON.parse(JSON.stringify(outputTemplate)) as any)
          : {};
        return composeAndAlign(parameterNodes, actionNodes, [
          {
            id: rfOutputId,
            type: "outputNode",
            position: { x: fixedXPosition, y: 0 },
            data: {
              rfId: rfOutputId,
              output: initialOutput,
              scaffolderActionIds,
              scaffolderActionInputsById,
              scaffolderActionInputRequiredById,
              scaffolderActionOutputsById,
            } satisfies OutputNodeData,
            ...nodeDefaults,
          },
        ]);
      }

      // Default: add an action node
      const rfActionId = `rf-action-${Math.random().toString(36).slice(2, 6)}`;
      const newStep = {
        id:
          stepTemplate?.id ??
          `step-id-${Math.random().toString(36).slice(2, 8)}`,
        name: stepTemplate?.name ?? "",
        action: stepTemplate?.action ?? "",
        input: { ...(stepTemplate?.input ?? {}) },
        ...(stepTemplate ?? {}),
      } satisfies TaskStep;

      const nextActions = [...actionNodes];
      const targetIndex = afterRfId
        ? Math.max(
            nextActions.findIndex((node) => node.id === afterRfId) + 1,
            0
          )
        : nextActions.length;
      nextActions.splice(targetIndex, 0, {
        id: rfActionId,
        type: "actionNode",
        position: { x: fixedXPosition, y: 0 },
        data: {
          rfId: rfActionId,
          step: newStep,
          scaffolderActionIds,
          scaffolderActionInputsById,
          scaffolderActionInputRequiredById,
          scaffolderActionOutputsById,
        } satisfies ActionNodeData,
        ...nodeDefaults,
      });

      return composeAndAlign(parameterNodes, nextActions, outputNodes);
    });
  };
};

export const createHandleUpdateField = (setNodes: SetNodes) => {
  return (rfId: string, field: keyof TaskStep, value: string) => {
    setNodes((nodes) =>
      nodes.map((node) =>
        node.id !== rfId
          ? node
          : ({
              ...node,
              data: {
                ...node.data,
                step: {
                  ...(node.data as ActionNodeData).step,
                  [field]: value,
                },
              },
            } as Node)
      )
    );
  };
};

export const createHandleUpdateInput = (setNodes: SetNodes) => {
  return (rfId: string, key: string, value: JsonValue | undefined) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== rfId) {
          return node;
        }
        const data = node.data as ActionNodeData;
        const baseInput = data.step?.input ?? {};
        const nextInput: Record<string, JsonValue> = {};
        Object.entries(baseInput).forEach(([existingKey, existingValue]) => {
          if (existingValue !== undefined) {
            nextInput[existingKey] = existingValue as JsonValue;
          }
        });
        if (value !== undefined) {
          nextInput[key] = value;
        }
        return {
          ...node,
          data: {
            ...data,
            step: { ...data.step, input: nextInput },
          },
        };
      })
    );
  };
};

export const createHandleRemoveInputKey = (setNodes: SetNodes) => {
  return (rfId: string, key: string) =>
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== rfId) {
          return node;
        }
        const data = node.data as ActionNodeData;
        const nextInput = { ...(data.step?.input ?? {}) };
        delete (nextInput as Record<string, JsonValue>)[key];
        return {
          ...node,
          data: {
            ...data,
            step: { ...data.step, input: nextInput },
          },
        };
      })
    );
};

export const createHandleUpdateOutput = (setNodes: SetNodes) => {
  return (
    rfId: string,
    updater: (prev: ScaffolderTaskOutput) => ScaffolderTaskOutput
  ) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== rfId) {
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

export const createHandleUpdateSections = (setNodes: SetNodes) => {
  return (
    rfId: string,
    updater: (prev: ParameterSectionDisplay[]) => ParameterSectionDisplay[]
  ) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== rfId) {
          return node;
        }
        const data = node.data as ParametersNodeData;
        const nextSections = updater(data.sections ?? []);
        return {
          ...node,
          data: {
            ...data,
            sections: nextSections,
            parameters: sectionsToParametersValue(nextSections),
          },
        };
      })
    );
  };
};

export const createHandleUpdateInputRequiredKeys = (setNodes: SetNodes) => {
  return (rfId: string, keys: string[]) =>
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id !== rfId) {
          return node;
        }
        const data = node.data as ActionNodeData;
        return {
          ...node,
          data: {
            ...data,
            scaffolderActionInputRequiredById: {
              ...(data.scaffolderActionInputRequiredById ?? {}),
              [data.step?.action ?? ""]: keys,
            },
          },
        };
      })
    );
};

export const createHandleRemoveNode = (
  setNodes: SetNodes,
  setEdges: SetEdges,
  options: CreateHandleRemoveNodeOptions
) => {
  const { fixedXPosition, verticalSpacing } = options;
  return (rfId: string) => {
    setNodes((nodes) => {
      const parameterNodes = nodes.filter((n) => n.type === "parametersNode");
      const actionNodes = nodes.filter(
        (n) => n.type === "actionNode" && n.id !== rfId
      );
      const outputNodes = nodes.filter((n) => n.type === "outputNode");

      const ordered = orderNodes(parameterNodes, actionNodes, outputNodes);
      const aligned = alignNodes(ordered, fixedXPosition, verticalSpacing);
      setSequentialEdgesIfChanged(setEdges, aligned);
      return aligned;
    });
  };
};

export const createHandleReorderAndAlignNodes = (
  setNodes: SetNodes,
  setEdges: SetEdges,
  options: CreateHandleRemoveNodeOptions
) => {
  const { fixedXPosition, verticalSpacing } = options;
  return (node: Node) => {
    if (!node) {
      return;
    }
    setNodes((nodes) => {
      const parameterNodes = nodes.filter((n) => n.type === "parametersNode");
      const actionNodes = nodes.filter((n) => n.type === "actionNode");
      const outputNodes = nodes.filter((n) => n.type === "outputNode");

      if (node.type === "parametersNode") {
        return alignNodes(
          orderNodes(
            [node, ...parameterNodes.filter((n) => n.id !== node.id)],
            actionNodes,
            outputNodes
          ),
          fixedXPosition,
          verticalSpacing
        );
      }

      if (node.type === "outputNode") {
        return alignNodes(
          orderNodes(parameterNodes, actionNodes, [
            node,
            ...outputNodes.filter((n) => n.id !== node.id),
          ]),
          fixedXPosition,
          verticalSpacing
        );
      }

      const filteredActionNodes = actionNodes.filter((n) => n.id !== node.id);
      const targetIndex = filteredActionNodes.findIndex(
        (n) => n.position.y > node.position.y
      );
      if (targetIndex === -1) {
        filteredActionNodes.push(node);
      } else {
        filteredActionNodes.splice(targetIndex, 0, node);
      }

      const ordered = orderNodes(
        parameterNodes,
        filteredActionNodes,
        outputNodes
      );
      const aligned = alignNodes(ordered, fixedXPosition, verticalSpacing);
      setSequentialEdgesIfChanged(setEdges, aligned);
      return aligned;
    });
  };
};
