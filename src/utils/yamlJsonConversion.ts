import { parse, stringify } from "yaml";

export const convertJsonToYaml = (value: unknown): string => {
  let source = value;

  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) {
      source = {};
    } else {
      try {
        source = JSON.parse(trimmed);
      } catch (error) {
        throw new Error(
          `Invalid JSON input provided for YAML conversion: ${
            error instanceof Error ? error.message : "unknown error"
          }`
        );
      }
    }
  }

  return stringify(source ?? {});
};

export const convertYamlToJson = (value: unknown): string => {
  let source = value;

  if (typeof source === "string") {
    const trimmed = source.trim();
    if (!trimmed) {
      source = {};
    } else {
      try {
        source = parse(trimmed);
      } catch (error) {
        throw new Error(
          `Invalid YAML input provided for JSON conversion: ${
            error instanceof Error ? error.message : "unknown error"
          }`
        );
      }
    }
  }

  try {
    return JSON.stringify(source ?? {});
  } catch (error) {
    throw new Error(
      `Unable to serialize value to JSON: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
};
