import type {
  TemplateParameterSchema,
  TemplateParametersV1beta3,
} from "@backstage/plugin-scaffolder-common";
import type {
  ParameterFieldDisplay,
  ParameterSectionDisplay,
  TemplateParametersValue,
} from "../types/flowNodes";

type ParameterPropertySchema = Record<string, unknown>;
type ParameterProperties = Record<string, ParameterPropertySchema>;
type ParameterDependencies = Record<string, unknown>;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : undefined;

const asSchemaRecord = (value: unknown): ParameterProperties | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as ParameterProperties;
};

const cloneSchema = (
  schema?: ParameterPropertySchema
): ParameterPropertySchema | undefined => {
  if (!schema) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(schema)) as ParameterPropertySchema;
};

const cloneProperties = (
  properties?: ParameterProperties
): Record<string, Record<string, unknown>> | undefined => {
  if (!properties) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(properties)) as Record<
    string,
    Record<string, unknown>
  >;
};

const cloneDependencies = (
  dependencies?: ParameterDependencies
): ParameterDependencies | undefined => {
  if (!dependencies || typeof dependencies !== "object") {
    return undefined;
  }
  return JSON.parse(JSON.stringify(dependencies)) as ParameterDependencies;
};

const buildDefaultSchema = (fieldName: string): ParameterPropertySchema => ({
  title: fieldName || "Field",
  type: "string",
});

const buildFieldsForSection = (
  sectionId: string,
  sectionTitle: string | undefined,
  properties?: Record<string, ParameterPropertySchema>,
  requiredList?: string[]
): ParameterFieldDisplay[] => {
  if (!properties) {
    return [];
  }

  return Object.entries(properties).map(([fieldName, schema], fieldIndex) => {
    const isRequired =
      Array.isArray(requiredList) && requiredList.includes(fieldName);
    const safeSchema = cloneSchema(schema) ?? buildDefaultSchema(fieldName);
    return {
      id: `${sectionId}-field-${fieldIndex}`,
      fieldName,
      sectionId,
      sectionTitle,
      required: Boolean(isRequired),
      schema: safeSchema,
    };
  });
};

const sanitizeField = (
  field: ParameterFieldDisplay,
  fallbackSectionId: string,
  index: number
): ParameterFieldDisplay => {
  const fieldId = field.id ?? `${fallbackSectionId}-field-${index}`;
  return {
    ...field,
    id: fieldId,
    sectionId: field.sectionId ?? fallbackSectionId,
    schema: cloneSchema(field.schema) ?? buildDefaultSchema(field.fieldName),
  };
};

const sanitizeSection = (
  section: ParameterSectionDisplay,
  index: number
): ParameterSectionDisplay => {
  const sectionId = section.id ?? `section-${index}`;
  const properties = asSchemaRecord(section.properties);
  const required = asStringArray(section.required);
  const dependencies = section.dependencies;
  const fields =
    section.fields
      ?.map((field, idx) => sanitizeField(field, sectionId, idx))
      ?.filter(Boolean) ?? [];

  let safeFields = fields;
  if (!fields.length) {
    safeFields = buildFieldsForSection(
      sectionId,
      section.title,
      properties,
      required ?? []
    );
  }

  return {
    ...section,
    id: sectionId,
    properties: cloneProperties(properties),
    dependencies: cloneDependencies(dependencies),
    required: required ?? [],
    fields: safeFields,
  };
};

export const sanitizeSections = (
  sections: ParameterSectionDisplay[]
): ParameterSectionDisplay[] =>
  sections.map((section, index) => sanitizeSection(section, index));

export const normalizeParametersToSections = (
  parameters: TemplateParametersValue
): ParameterSectionDisplay[] => {
  if (!Array.isArray(parameters)) {
    return [];
  }

  const unsafe = (parameters as TemplateParameterSchema[]).filter(
    (param) => param && typeof param === "object"
  );

  return unsafe.map((param, index) =>
    sanitizeSection(
      {
        id: (param as any).id ?? `section-${index}`,
        title: asString((param as any).title),
        description: asString((param as any).description),
        required: asStringArray((param as any).required),
        properties: asSchemaRecord((param as any).properties),
        dependencies: cloneDependencies((param as any).dependencies),
        fields: [],
      },
      index
    )
  );
};

export const sectionsToParametersValue = (
  sections: ParameterSectionDisplay[] | undefined
): TemplateParametersValue => {
  if (!sections) {
    return [];
  }

  const normalizedSections = sanitizeSections(sections);

  const result: TemplateParametersV1beta3[] = normalizedSections.map(
    (section, index) => {
      const properties =
        section.fields?.reduce<ParameterProperties>((acc, field) => {
          if (!field.fieldName) {
            return acc;
          }
          acc[field.fieldName] =
            cloneSchema(field.schema) ?? buildDefaultSchema(field.fieldName);
          return acc;
        }, {}) ?? {};

      const required =
        section.fields
          ?.filter((field) => field.required && field.fieldName)
          ?.map((field) => field.fieldName) ?? [];

      const dependencies = cloneDependencies(section.dependencies) as
        | Record<string, unknown>
        | undefined;

      const defaultSectionTitle = `Section ${index + 1}`;

      const output: TemplateParametersV1beta3 = {
        title: section.title ?? defaultSectionTitle,
        description: section.description,
        properties: properties as TemplateParametersV1beta3["properties"],
      };

      if (dependencies && Object.keys(dependencies).length > 0) {
        output.dependencies =
          dependencies as TemplateParametersV1beta3["dependencies"];
      }

      if (required.length > 0) {
        output.required = required;
      }

      return output;
    }
  );

  return result;
};
