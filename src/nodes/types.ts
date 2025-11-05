import type {
  ScaffolderTaskOutput,
  TaskStep,
  TemplateParametersV1beta3,
  TemplateParameterSchema,
} from "@backstage/plugin-scaffolder-common";

export type DesignerNodeType =
  | "parametersNode"
  | "actionNode"
  | "outputNode";

export type TemplateParametersValue =
  | TemplateParametersV1beta3
  | TemplateParametersV1beta3[]
  | TemplateParameterSchema
  | TemplateParameterSchema[]
  | undefined;

export type AddNodeConfig = {
  afterRfId: string;
  type?: DesignerNodeType;
  stepTemplate?: Partial<TaskStep>;
  outputTemplate?: ScaffolderTaskOutput;
  parametersTemplate?: TemplateParametersValue;
};

type BaseNodeData = {
  /** Stable ReactFlow node id */
  rfId: string;
  /** Cached scaffolder action ids for dropdown options */
  scaffolderActionIds?: string[];
  /** Cached action input schemas keyed by action id */
  scaffolderActionInputsById?: Record<string, Record<string, unknown>>;
  /** Cached action output schemas keyed by action id */
  scaffolderActionOutputsById?: Record<string, Record<string, unknown>>;
  /** Suggestions for referencing previous step outputs */
  stepOutputReferences?: string[];
  onAddNode?: (config: AddNodeConfig) => void;
};

export type ActionNodeData = BaseNodeData & {
  /** User payload; id is editable string (reserved by your template) */
  step: TaskStep & { input?: Record<string, unknown> };
  onUpdateField?: (rfId: string, field: keyof TaskStep, value: string) => void;
  onUpdateInput?: (rfId: string, key: string, value: unknown) => void;
  onRemoveInputKey?: (rfId: string, key: string) => void;
};

export type OutputNodeData = BaseNodeData & {
  output: ScaffolderTaskOutput;
  onUpdateOutput?: (
    rfId: string,
    updater: (prev: ScaffolderTaskOutput) => ScaffolderTaskOutput
  ) => void;
};

export type ParametersNodeData = BaseNodeData & {
  parameters: TemplateParametersValue;
  onUpdateParameters?: (
    rfId: string,
    updater: (
      prev: TemplateParametersValue
    ) => TemplateParametersValue
  ) => void;
};

export const NODE_VERTICAL_SPACING: Record<DesignerNodeType, number> = {
  parametersNode: 520,
  actionNode: 420,
  outputNode: 480,
};
