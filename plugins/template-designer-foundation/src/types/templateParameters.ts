import type {
  TemplateParametersV1beta3,
  TemplateParameterSchema,
} from "@backstage/plugin-scaffolder-common";

export type TemplateParametersValue =
  | TemplateParametersV1beta3
  | TemplateParametersV1beta3[]
  | TemplateParameterSchema
  | TemplateParameterSchema[]
  | undefined;
