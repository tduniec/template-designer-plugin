import type { Node } from "@xyflow/react";

// Pure helpers for serializing/deserializing flow nodes and template models.
import type {
  TaskStep,
  ScaffolderTaskOutput,
} from "@backstage/plugin-scaffolder-common";
import type {
  ActionNodeData,
  OutputNodeData,
  ParametersNodeData,
  TemplateParametersValue,
} from "../../nodes/types";
import { alignNodes } from "./nodeLayout";
import { normalizeParametersToSections } from "./parameterTransforms";
import { FLOW_LAYOUT, nodeDefaults } from "./flowConfig";

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
      scaffolderActionOutputsById,
    },
    ...nodeDefaults,
  });

  const actionNodes = steps.map((step, index) => {
    const rfId = buildRfId(step, index);
    return {
      id: rfId,
      type: "actionNode",
      position: { x: FLOW_LAYOUT.fixedXPosition, y: 0 },
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
      position: { x: FLOW_LAYOUT.fixedXPosition, y: 0 },
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

  return alignNodes(
    nodes,
    FLOW_LAYOUT.fixedXPosition,
    FLOW_LAYOUT.verticalSpacing
  );
};

export const collectParameterReferences = (
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
      .sort(([a], [b]) => {
        if (a > b) {
          return 1;
        }
        if (a < b) {
          return -1;
        }
        return 0;
      });
    return entries.reduce<Record<string, unknown>>((acc, [key, val]) => {
      acc[key] = normalizeValueForStableStringify(val);
      return acc;
    }, {});
  }
  return value;
};

export const stableStringify = (value: unknown): string =>
  JSON.stringify(normalizeValueForStableStringify(value));

export const resolveNodeHeightForTracking = (
  node: Node
): number | undefined => {
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

const sortNodesByY = (nodes: Node[]) =>
  [...nodes].sort((a, b) => a.position.y - b.position.y);

export const extractStepsFromNodes = (nodes: Node[]): TaskStep[] => {
  const sorted = sortNodesByY(nodes);
  return sorted
    .map((node) => {
      const data = node.data as ActionNodeData | undefined;
      if (!data || !data.step) {
        return undefined;
      }
      return cloneStep(data.step as TaskStep);
    })
    .filter((step): step is TaskStep => !!step);
};

export const extractParametersFromNodes = (
  nodes: Node[]
): TemplateParametersValue | undefined => {
  const parametersNode = sortNodesByY(nodes).find(
    (node) => node.type === "parametersNode"
  );
  if (!parametersNode) {
    return undefined;
  }
  const data = parametersNode.data as ParametersNodeData | undefined;
  if (!data) {
    return undefined;
  }
  return cloneParameters(data.parameters);
};

export const extractOutputFromNodes = (
  nodes: Node[]
): ScaffolderTaskOutput | undefined => {
  const outputNode = sortNodesByY(nodes).find(
    (node) => node.type === "outputNode"
  );
  if (!outputNode) {
    return undefined;
  }
  const data = outputNode.data as OutputNodeData | undefined;
  if (!data) {
    return undefined;
  }
  return cloneOutput(data.output);
};
