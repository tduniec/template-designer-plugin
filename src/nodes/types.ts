import type {
  ScaffolderTaskOutput,
  TaskStep,
} from "@backstage/plugin-scaffolder-common";

export type DesignerNodeType = "actionNode" | "outputNode";

export type AddNodeConfig = {
  afterRfId: string;
  type?: DesignerNodeType;
  stepTemplate?: Partial<TaskStep>;
  outputTemplate?: ScaffolderTaskOutput;
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
