import type { ReactNode } from "react";
import type {
  ParameterFieldDisplay,
  ParameterSectionDisplay,
} from "../../types/flowNodes";

export type ParameterFormState = {
  values: Record<string, unknown>;
};

export type ParameterInputExtrasArgs = {
  fieldId: string;
  fieldPath: string[];
  fieldModel: ParameterFieldDisplay;
  schema?: Record<string, unknown>;
  uiSchema?: Record<string, unknown>;
  formState?: ParameterFormState;
  onFieldChange?: (
    updater: (field: ParameterFieldDisplay) => ParameterFieldDisplay
  ) => void;
  nodeId?: string;
  isSelected?: boolean;
};

/**
 * Example:
 * const extensions: ParameterNodeExtensions = {
 *   renderInputExtras: ({ fieldId }) => <MyPanel targetFieldId={fieldId} />,
 * };
 */
export type ParameterNodeExtensions = {
  renderInputExtras?: (args: ParameterInputExtrasArgs) => ReactNode;
  renderSectionExtras?: (args: ParameterSectionExtrasArgs) => ReactNode;
};

export type ParameterSectionExtrasArgs = {
  section: ParameterSectionDisplay;
  sections: ParameterSectionDisplay[];
  formState?: ParameterFormState;
  nodeId?: string;
  onSectionChange?: (
    updater: (prev: ParameterSectionDisplay) => ParameterSectionDisplay
  ) => void;
  onAddField?: (sectionId: string, afterFieldId?: string) => void;
};
