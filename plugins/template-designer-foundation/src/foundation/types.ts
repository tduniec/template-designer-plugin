import type { ComponentType } from "react";
import type { NodeProps } from "@xyflow/react";
import type { TemplateEntityV1beta3 } from "@backstage/plugin-scaffolder-common";

export type RegisteredActionNode = {
  id: string;
  component: ComponentType<NodeProps>;
  locked: boolean;
};

export type FeatureFlagClient = {
  isEnabled: (flag: string) => boolean;
};

export type TemplateSourceProvider = {
  id: string;
  label: string;
  selectTemplate: () => Promise<TemplateEntityV1beta3 | null>;
};
