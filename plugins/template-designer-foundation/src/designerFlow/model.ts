import type { Node } from "@xyflow/react";
import type {
  TaskStep,
  ScaffolderTaskOutput,
} from "@backstage/plugin-scaffolder-common";
import type {
  ActionNodeData,
  OutputNodeData,
  ParametersNodeData,
  TemplateParametersValue,
} from "../types/flowNodes";
import { alignNodes } from "./nodeLayout";
import { normalizeParametersToSections } from "./parameterTransforms";
import { FLOW_LAYOUT, nodeDefaults } from "../components/designerFlowConfig";

const sanitizeForRfId = (value: string) =>
  value.replace(/[^a-zA-Z0-9-_.:]/g, "_");

const buildRfId = (step: TaskStep | undefined, index: number) => {
  if (step && typeof step.id === "string" && step.id.trim().length > 0) {
    return `rf-${sanitizeForRfId(step.id)}-${index}`;
  }
  return `rf-${index + 1}`;
};

export const cloneStep = (step: TaskStep): TaskStep =>
  JSON.parse(JSON.stringify(step ?? {})) as TaskStep;

export const cloneOutput = (
  output: ScaffolderTaskOutput | undefined | null
): ScaffolderTaskOutput =>
  JSON.parse(JSON.stringify(output ?? {})) as ScaffolderTaskOutput;

export const cloneParameters = (
  parameters: TemplateParametersValue
): TemplateParametersValue =>
  parameters === undefined
    ? undefined
    : (JSON.parse(JSON.stringify(parameters)) as TemplateParametersValue);

export type BuildNodesFromModelOptions = {
  scaffolderActionIds: string[];
  scaffolderActionInputsById: Record<string, Record<string, unknown>>;
  scaffolderActionOutputsById: Record<string, Record<string, unknown>>;
  scaffolderActionInputRequiredById: Record<string, string[]>;
};

export const buildNodesFromModel = (
  steps: TaskStep[],
  parameters: TemplateParametersValue,
  output: ScaffolderTaskOutput | undefined | null,
  options: BuildNodesFromModelOptions
) => {
  const {
    scaffolderActionIds,
    scaffolderActionInputsById,
    scaffolderActionOutputsById,
    scaffolderActionInputRequiredById,
  } = options;

  const parameterSections = normalizeParametersToSections(parameters);
  const nodes: Node[] = [];

  const rfParametersId = "rf-parameters";
  nodes.push({
    id: rfParametersId,
    type: "parametersNode",
    position: { x: FLOW_LAYOUT.fixedXPosition, y: 0 },
    data: {
      rfId: rfParametersId,
      parameters: cloneParameters(parameters),
      sections: parameterSections,
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionInputRequiredById,
      scaffolderActionOutputsById,
    },
    ...nodeDefaults,
  });

  const rfOutputId = "rf-output";
  nodes.push({
    id: rfOutputId,
    type: "outputNode",
    position: {
      x: FLOW_LAYOUT.fixedXPosition,
      y: FLOW_LAYOUT.verticalSpacing * (steps.length + 1),
    },
    data: {
      rfId: rfOutputId,
      output: cloneOutput(output),
      scaffolderActionIds,
      scaffolderActionInputsById,
      scaffolderActionInputRequiredById,
      scaffolderActionOutputsById,
    } satisfies OutputNodeData,
    ...nodeDefaults,
  });

  steps.forEach((step, index) => {
    const rfId = buildRfId(step, index);
    nodes.splice(index + 1, 0, {
      id: rfId,
      type: "actionNode",
      position: {
        x: FLOW_LAYOUT.fixedXPosition,
        y: FLOW_LAYOUT.verticalSpacing * (index + 1),
      },
      data: {
        rfId,
        step: cloneStep(step),
        scaffolderActionIds,
        scaffolderActionInputsById,
        scaffolderActionInputRequiredById,
        scaffolderActionOutputsById,
      } satisfies ActionNodeData,
      ...nodeDefaults,
    });
  });

  return alignNodes(
    nodes,
    FLOW_LAYOUT.fixedXPosition,
    FLOW_LAYOUT.verticalSpacing
  );
};

const normalizeStepOrder = (step: TaskStep): TaskStep => {
  // Keep existing values intact; only adjusts insertion order for export.
  const { if: stepIf, each: stepEach, ...rest } = step as Record<string, any>;
  const ordered: Record<string, any> = {};
  if (stepIf !== undefined) {
    ordered.if = stepIf;
  }
  if (stepEach !== undefined) {
    ordered.each = stepEach;
  }
  // Preserve all other fields in their existing relative order.
  Object.keys(rest).forEach((key) => {
    ordered[key] = rest[key];
  });
  return ordered as TaskStep;
};

export const extractStepsFromNodes = (nodes: Node[]): TaskStep[] => {
  const actionNodes = nodes.filter(
    (node) => node.type === "actionNode"
  ) as Node<ActionNodeData>[];
  return actionNodes.map((node) =>
    normalizeStepOrder(stripEmptyConditionals(cloneStep(node.data.step)))
  );
};

const stripEmptyConditionals = (step: TaskStep): TaskStep => {
  const next = { ...step } as TaskStep;
  if (next.if === "" || next.if === undefined) {
    delete (next as any).if;
  }
  if (next.each === "" || next.each === undefined) {
    delete (next as any).each;
  }
  return next;
};

export const extractParametersFromNodes = (
  nodes: Node[]
): TemplateParametersValue => {
  const parametersNode = nodes.find(
    (node) => node.type === "parametersNode"
  ) as Node<ParametersNodeData> | undefined;
  if (!parametersNode) {
    return [];
  }
  return cloneParameters(parametersNode.data.parameters);
};

export const extractOutputFromNodes = (
  nodes: Node[]
): ScaffolderTaskOutput | undefined => {
  const outputNode = nodes.find((node) => node.type === "outputNode") as
    | Node<OutputNodeData>
    | undefined;
  if (!outputNode) {
    return undefined;
  }
  return cloneOutput(outputNode.data.output);
};

export const collectParameterReferences = (
  parameters: TemplateParametersValue | undefined
): string[] => {
  if (!parameters || !Array.isArray(parameters)) {
    return [];
  }
  return parameters.flatMap((param) =>
    Object.keys((param as any)?.properties ?? {}).map(
      (propKey) => `\${{ parameters.${propKey} }}`
    )
  );
};

export const collectStepOutputReferences = (
  nodes: Node[],
  parameterReferences: string[]
): Record<string, string[]> => {
  const formatStepOutputProp = (stepId: string, prop: string) =>
    `\${{ steps['${stepId}'].output.${prop} }}`;

  const referencesByNode: Record<string, string[]> = {};
  const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);
  const accumulatedReferences: string[] = [...parameterReferences];
  const accumulatedSet = new Set<string>(parameterReferences);
  const outputKeysByStepId: Record<string, string[]> = {};

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
      // Prefer nested properties if present; otherwise use top-level keys.
      const props =
        (schemaOutputs as { properties?: Record<string, unknown> })
          .properties ?? schemaOutputs;
      Object.keys(props ?? {}).forEach((key) => {
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

    if (outputKeys.size === 0) {
      return;
    }

    outputKeysByStepId[stepId] = Array.from(outputKeys);

    // Add per-key references from schema/output values (omit whole output object to avoid unusable suggestion).
    outputKeys.forEach((outputKey) => {
      const reference = formatStepOutputProp(stepId, outputKey);
      if (!accumulatedSet.has(reference)) {
        accumulatedSet.add(reference);
        accumulatedReferences.push(reference);
      }
    });
  });

  return referencesByNode;
};

export const stableStringify = (value: unknown) =>
  JSON.stringify(value, (_key, v) => {
    if (Array.isArray(v)) {
      return v;
    }
    if (v && typeof v === "object") {
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = (v as Record<string, unknown>)[k];
          return acc;
        }, {});
    }
    return v;
  });
