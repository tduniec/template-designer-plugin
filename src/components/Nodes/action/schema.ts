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
): NormalizedSchemaType => {
  if (!type) {
    return "string";
  }
  const value = Array.isArray(type) ? type[0] : type;
  if (
    value === "string" ||
    value === "number" ||
    value === "integer" ||
    value === "boolean" ||
    value === "array" ||
    value === "object"
  ) {
    return value;
  }
  return "string";
};

export const normalizeSchemaType = (
  schema: JsonSchemaProperty | undefined
): NormalizedSchemaType => {
  if (!schema || typeof schema !== "object") {
    return "string";
  }
  return getFirstType(schema.type);
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

  if (type === "array" || type === "object") {
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
