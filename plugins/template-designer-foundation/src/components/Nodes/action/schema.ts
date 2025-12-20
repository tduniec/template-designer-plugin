export type JsonSchemaProperty = Record<string, unknown>;

export type NormalizedSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "unknown";

export const normalizeSchemaType = (
  schema?: JsonSchemaProperty,
  value?: unknown
): NormalizedSchemaType => {
  const explicitType = typeof schema === "object" ? schema?.type : undefined;
  if (explicitType === "string") return "string";
  if (explicitType === "number") return "number";
  if (explicitType === "integer") return "integer";
  if (explicitType === "boolean") return "boolean";
  if (explicitType === "array") return "array";
  if (explicitType === "object") return "object";

  const inferredType = typeof value;
  if (inferredType === "string") return "string";
  if (inferredType === "number") return "number";
  if (Array.isArray(value)) return "array";
  if (value && typeof value === "object") return "object";
  if (typeof value === "boolean") return "boolean";

  return "unknown";
};

export const buildTypeLabel = (schema?: JsonSchemaProperty) => {
  if (!schema) {
    return "";
  }
  if (schema.type) {
    if (Array.isArray(schema.type)) {
      return schema.type.join(" | ");
    }
    return String(schema.type);
  }
  return "";
};

export const extractEnumOptions = (schema?: JsonSchemaProperty): string[] => {
  if (Array.isArray(schema?.enum)) {
    return schema.enum
      .map((value) => (typeof value === "string" ? value : null))
      .filter(Boolean) as string[];
  }
  return [];
};

export const coerceValueForType = (
  value: string,
  type: NormalizedSchemaType
): unknown => {
  if (type === "number" || type === "integer") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? value : parsed;
  }
  if (type === "boolean") {
    if (value === "true") return true;
    if (value === "false") return false;
  }
  if (type === "array" || type === "object") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
};

export const stringifyValueForDisplay = (
  value: unknown,
  type: NormalizedSchemaType
): string => {
  if (value === undefined || value === null) {
    return "";
  }
  if (type === "object" || type === "array") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
};
