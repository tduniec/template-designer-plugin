export type JsonSchemaProperty = {
  type?: string | string[];
  enum?: unknown[];
  items?: JsonSchemaProperty | JsonSchemaProperty[];
} & Record<string, unknown>;

export type NormalizedSchemaType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object"
  | "unknown";

const capitalize = (value: string) =>
  value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;

const getFirstType = (
  type: string | string[] | undefined
): NormalizedSchemaType | undefined => {
  if (!type) {
    return undefined;
  }
  const values = Array.isArray(type) ? type : [type];
  const match = values.find(
    (value): value is NormalizedSchemaType =>
      value === "string" ||
      value === "number" ||
      value === "integer" ||
      value === "boolean" ||
      value === "array" ||
      value === "object"
  );
  return match;
};

const inferTypeFromValue = (
  value: unknown
): NormalizedSchemaType | undefined => {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value === "object") {
    return "object";
  }
  if (typeof value === "boolean") {
    return "boolean";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? "integer" : "number";
  }
  return undefined;
};

export const normalizeSchemaType = (
  schema: JsonSchemaProperty | undefined,
  value?: unknown
): NormalizedSchemaType => {
  if (!schema || typeof schema !== "object") {
    const inferred = inferTypeFromValue(value);
    return inferred ?? "string";
  }
  const schemaType = getFirstType(schema.type);
  if (schemaType) {
    return schemaType;
  }
  const inferred = inferTypeFromValue(value);
  if (inferred) {
    return inferred;
  }
  return "string";
};

const getArrayItemTypeLabel = (schema: JsonSchemaProperty | undefined) => {
  if (!schema) {
    return "";
  }
  const items = schema.items;
  if (!items) {
    return "";
  }
  if (Array.isArray(items)) {
    const [first] = items;
    if (!first) {
      return "";
    }
    return capitalize(normalizeSchemaType(first));
  }
  return capitalize(normalizeSchemaType(items));
};

export const buildTypeLabel = (schema: JsonSchemaProperty | undefined) => {
  const normalized = normalizeSchemaType(schema);
  if (normalized === "array") {
    const itemsLabel = getArrayItemTypeLabel(schema);
    return itemsLabel ? `Array<${itemsLabel}>` : "Array";
  }
  if (normalized === "integer") {
    return "Integer";
  }
  if (normalized === "unknown") {
    return "Unknown";
  }
  return capitalize(normalized);
};

export const stringifyValueForDisplay = (
  value: unknown,
  type: NormalizedSchemaType
) => {
  if (value === undefined || value === null) {
    return "";
  }

  if (
    type === "array" ||
    type === "object" ||
    Array.isArray(value) ||
    typeof value === "object"
  ) {
    if (typeof value === "string") {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return String(value);
};

export const coerceValueForType = (
  raw: string,
  type: NormalizedSchemaType
): unknown => {
  if (raw === "") {
    return "";
  }

  if (type === "boolean") {
    if (raw === "true") {
      return true;
    }
    if (raw === "false") {
      return false;
    }
    return raw;
  }

  if (type === "number" || type === "integer") {
    const num = Number(raw);
    if (!Number.isNaN(num)) {
      return num;
    }
    return raw;
  }

  if (type === "array" || type === "object") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  return raw;
};

export const extractEnumOptions = (schema: JsonSchemaProperty | undefined) => {
  if (!schema || !Array.isArray(schema.enum)) {
    return [] as string[];
  }
  return schema.enum
    .map((option): string => {
      if (option === undefined || option === null) {
        return "";
      }
      if (typeof option === "object") {
        try {
          return JSON.stringify(option);
        } catch {
          return String(option);
        }
      }
      return String(option);
    })
    .filter((option) => option !== "");
};
