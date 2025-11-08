import type {
  TemplateParameterSchema,
  TemplateParametersV1beta3,
} from "@backstage/plugin-scaffolder-common";
import type {
  ParameterFieldDisplay,
  ParameterSectionDisplay,
  TemplateParametersValue,
} from "../../nodes/types";

type ParameterPropertySchema = Record<string, unknown>;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asStringArray = (value: unknown): string[] | undefined =>
  Array.isArray(value) && value.every((item) => typeof item === "string")
    ? (value as string[])
    : undefined;

const asSchemaRecord = (
  value: unknown
): Record<string, ParameterPropertySchema> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, ParameterPropertySchema>;
};

const cloneSchema = (
  schema?: ParameterPropertySchema
): ParameterPropertySchema | undefined => {
  if (!schema) {
    return undefined;
  }
  return JSON.parse(JSON.stringify(schema)) as ParameterPropertySchema;
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

const rebuildSectionMeta = (
  section: ParameterSectionDisplay,
  index: number
): ParameterSectionDisplay => {
  const fallbackId = section.id ?? `section-${index}`;
  const sanitizedFields = (section.fields ?? []).map((field, fieldIndex) =>
    sanitizeField(field, fallbackId, fieldIndex)
  );

  const properties = sanitizedFields.reduce<
    Record<string, ParameterPropertySchema>
  >((acc, field) => {
    if (!field.fieldName) {
      return acc;
    }
    acc[field.fieldName] =
      cloneSchema(field.schema) ?? buildDefaultSchema(field.fieldName);
    return acc;
  }, {});

  const required = sanitizedFields
    .filter((field) => field.required && field.fieldName)
    .map((field) => field.fieldName);

  const propagatedFields = sanitizedFields.map((field) => ({
    ...field,
    sectionTitle: section.title ?? field.sectionTitle,
  }));

  return {
    ...section,
    id: fallbackId,
    fields: propagatedFields,
    properties,
    required,
  };
};

export const sanitizeSections = (
  sections: ParameterSectionDisplay[] | undefined
): ParameterSectionDisplay[] =>
  (sections ?? []).map((section, index) => rebuildSectionMeta(section, index));

export const sectionsToParametersValue = (
  sections: ParameterSectionDisplay[]
): TemplateParametersValue => {
  const sanitizedSections = sanitizeSections(sections);
  if (!sanitizedSections.length) {
    return undefined;
  }

  const templates = sanitizedSections
    .map((section) => {
      const properties = section.properties ?? {};
      if (!Object.keys(properties).length) {
        return null;
      }
      const template: TemplateParametersV1beta3 = {
        title: section.title,
        description: section.description,
        required:
          section.required && section.required.length
            ? [...section.required]
            : undefined,
        properties: JSON.parse(JSON.stringify(properties)),
      };
      return template;
    })
    .filter((entry): entry is TemplateParametersV1beta3 => entry !== null);

  if (!templates.length) {
    return undefined;
  }

  return templates.length === 1 ? [templates[0]] : templates;
};

export const normalizeParametersToSections = (
  parameters: TemplateParametersValue
): ParameterSectionDisplay[] => {
  if (parameters === undefined || parameters === null) {
    return [];
  }

  const entries = Array.isArray(parameters) ? parameters : [parameters];
  const sections: ParameterSectionDisplay[] = [];

  entries.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") {
      return;
    }

    const record = entry as Record<string, any>;
    const steps = Array.isArray(record.steps) ? record.steps : [];
    if (steps.length > 0) {
      steps.forEach((step, stepIndex) => {
        if (!step || typeof step !== "object") {
          return;
        }
        const schema = (step as Record<string, any>).schema;
        if (!schema || typeof schema !== "object") {
          return;
        }
        const sectionSchema = schema as TemplateParametersV1beta3;
        const stepRecord = step as Record<string, any>;
        const sectionTitle =
          asString(stepRecord.title) ??
          asString(sectionSchema.title) ??
          `Step ${stepIndex + 1}`;
        const sectionDescription =
          asString(stepRecord.description) ??
          asString(sectionSchema.description);
        const sectionProperties =
          asSchemaRecord(sectionSchema.properties) ?? {};
        const required = asStringArray(sectionSchema.required) ?? [];
        const sectionId = `section-${index}-step-${stepIndex}`;
        sections.push({
          id: sectionId,
          title: sectionTitle,
          description: sectionDescription,
          properties: sectionProperties,
          required,
          fields: buildFieldsForSection(
            sectionId,
            sectionTitle,
            sectionProperties,
            required
          ),
        });
      });
      return;
    }

    const schema = record as TemplateParametersV1beta3;
    const schemaTitle = asString(schema.title);
    const schemaDescription = asString(schema.description);
    const sectionProperties = asSchemaRecord(schema.properties);

    if (sectionProperties && Object.keys(sectionProperties).length > 0) {
      const required = asStringArray(schema.required) ?? [];
      const sectionId = `section-${index}`;
      sections.push({
        id: sectionId,
        title: schemaTitle ?? `Section ${index + 1}`,
        description: schemaDescription,
        properties: sectionProperties,
        required,
        fields: buildFieldsForSection(
          sectionId,
          schemaTitle,
          sectionProperties,
          required
        ),
      });
      return;
    }

    const parameterSchema = entry as TemplateParameterSchema;
    const fallbackKey = schemaTitle ?? `field-${index + 1}`;
    const sectionId = `section-${index}`;
    const fallbackProperties: Record<string, ParameterPropertySchema> = {
      [fallbackKey]: parameterSchema as ParameterPropertySchema,
    };

    sections.push({
      id: sectionId,
      title: schemaTitle ?? `Section ${index + 1}`,
      description: schemaDescription,
      properties: fallbackProperties,
      required: [],
      fields: buildFieldsForSection(
        sectionId,
        schemaTitle,
        fallbackProperties,
        []
      ),
    });
  });

  return sections;
};
