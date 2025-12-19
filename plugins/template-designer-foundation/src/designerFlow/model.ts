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

export const extractStepsFromNodes = (nodes: Node[]): TaskStep[] => {
  const actionNodes = nodes.filter(
    (node) => node.type === "actionNode"
  ) as Node<ActionNodeData>[];
  return actionNodes.map((node) => cloneStep(node.data.step));
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
      (propKey) => `parameters.${propKey}`
    )
  );
};

export const collectStepOutputReferences = (
  nodes: Node[],
  parameterReferences: string[]
): Record<string, string[]> => {
  const formatRef = (ref: string) => `\${{ ${ref} }}`;

  const actionNodes = nodes.filter(
    (node) => node.type === "actionNode"
  ) as Node<ActionNodeData>[];
  const outputNode = nodes.find((node) => node.type === "outputNode") as
    | Node<OutputNodeData>
    | undefined;

  const references: Record<string, string[]> = {};

  actionNodes.forEach((node, index) => {
    const priorSteps = actionNodes
      .slice(0, index)
      .map((n) => n.data?.step?.id)
      .filter(Boolean) as string[];
    const priorStepRefs = priorSteps.map((id) =>
      formatRef(`steps.${id}.output`)
    );
    const priorIds = priorSteps.map((id) => formatRef(`steps.${id}.id`));
    const parameterRefs = parameterReferences.map((ref) => formatRef(ref));

    const thisStepId = node.data?.step?.id;
    if (!thisStepId) {
      references[node.id] = [...parameterRefs, ...priorStepRefs, ...priorIds];
      return;
    }

    const outputRefs = [
      formatRef(`steps.${thisStepId}.output`),
      ...priorStepRefs,
      ...parameterRefs,
    ];
    references[node.id] = Array.from(new Set(outputRefs));
  });

  if (outputNode) {
    const allSteps = actionNodes.map((n) => n.data?.step?.id).filter(Boolean);
    const refs = [
      ...allSteps.map((id) => formatRef(`steps.${id}.output`)),
      ...parameterReferences.map((ref) => formatRef(ref)),
    ];
    references[outputNode.id] = Array.from(new Set(refs));
  }

  return references;
};

export const stableStringify = (value: unknown) =>
  JSON.stringify(value, Object.keys(value as any).sort());
