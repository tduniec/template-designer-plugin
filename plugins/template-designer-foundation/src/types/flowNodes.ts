import type {
  ScaffolderTaskOutput,
  TaskStep,
} from "@backstage/plugin-scaffolder-common";
import type { ReactNode } from "react";
import type { TemplateParametersValue } from "./templateParameters";
import type {
  ParameterFormState,
  ParameterNodeExtensions,
} from "../parameters/extensions/types";

export type DesignerNodeType = "parametersNode" | "actionNode" | "outputNode";

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
  /** Cached action required input keys keyed by action id */
  scaffolderActionInputRequiredById?: Record<string, string[]>;
  /** Cached action output schemas keyed by action id */
  scaffolderActionOutputsById?: Record<string, Record<string, unknown>>;
  /** Suggestions for referencing previous step outputs */
  stepOutputReferences?: string[];
  onAddNode?: (config: AddNodeConfig) => void;
  onRemoveNode?: (rfId: string) => void;
  /** DOM-measured height used to stabilize layout */
  measuredHeight?: number;
};

export type ActionNodeData = BaseNodeData & {
  /** User payload; id is editable string (reserved by your template) */
  step: TaskStep & { input?: Record<string, unknown> };
  onUpdateField?: (rfId: string, field: keyof TaskStep, value: string) => void;
  onUpdateInput?: (rfId: string, key: string, value: unknown) => void;
  onRemoveInputKey?: (rfId: string, key: string) => void;
  /** Optional slot to inject additional icons/actions into the header. */
  headerActionsSlot?: ReactNode;
  /** Optional slot to render custom UI above the key/value input grid. */
  inputsLeadingSlot?: ReactNode;
};

export type OutputNodeData = BaseNodeData & {
  output: ScaffolderTaskOutput;
  onUpdateOutput?: (
    rfId: string,
    updater: (prev: ScaffolderTaskOutput) => ScaffolderTaskOutput
  ) => void;
};

export type ParameterFieldDisplay = {
  id: string;
  fieldName: string;
  sectionId: string;
  sectionTitle?: string;
  required: boolean;
  schema?: Record<string, unknown>;
};

export type ParameterSectionDisplay = {
  id: string;
  title?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, Record<string, unknown>>;
  dependencies?: Record<string, unknown>;
  fields: ParameterFieldDisplay[];
};

export type ParametersNodeData = BaseNodeData & {
  parameters: TemplateParametersValue;
  sections?: ParameterSectionDisplay[];
  extensions?: ParameterNodeExtensions;
  formState?: ParameterFormState;
  onUpdateSections?: (
    rfId: string,
    updater: (prev: ParameterSectionDisplay[]) => ParameterSectionDisplay[]
  ) => void;
};

export const NODE_VERTICAL_SPACING: Record<DesignerNodeType, number> = {
  parametersNode: 120,
  actionNode: 120,
  outputNode: 120,
};

export type { TemplateParametersValue };
