import { useMemo } from "react";
import type { TaskStep } from "@backstage/plugin-scaffolder-common";
import type { ActionNodeData } from "../types";
import type { JsonSchemaProperty, NormalizedSchemaType } from "./schema";
import {
  buildTypeLabel,
  extractEnumOptions,
  normalizeSchemaType,
} from "./schema";

type ActionInputOption = {
  key: string;
  label: string;
  schema?: JsonSchemaProperty;
  type: NormalizedSchemaType;
};

type UseActionInputsArgs = {
  data: ActionNodeData;
  step: TaskStep;
  actionId: string;
  newKey: string;
};

export const useActionInputs = ({
  data,
  step,
  actionId,
  newKey,
}: UseActionInputsArgs) => {
  const actionInputSchema = useMemo(() => {
    if (!actionId) {
      return {} as Record<string, JsonSchemaProperty>;
    }
    const inputs = (data.scaffolderActionInputsById?.[actionId] ??
      {}) as Record<string, JsonSchemaProperty>;
    return inputs;
  }, [actionId, data.scaffolderActionInputsById]);

  const actionInputOptions = useMemo<ActionInputOption[]>(() => {
    return Object.entries(actionInputSchema).map(([key, schema]) => {
      const normalized = normalizeSchemaType(schema);
      const label = buildTypeLabel(schema);
      return {
        key,
        label: label ? `${key} (${label})` : key,
        schema,
        type: normalized,
      };
    });
  }, [actionInputSchema]);

  const inputEntries = useMemo(
    () => Object.entries(step.input ?? {}),
    [step.input]
  );
  const usedInputKeys = useMemo(
    () => new Set(inputEntries.map(([key]) => key)),
    [inputEntries]
  );
  const availableInputOptions = useMemo(
    () => actionInputOptions.filter((option) => !usedInputKeys.has(option.key)),
    [actionInputOptions, usedInputKeys]
  );
  const trimmedNewKey = newKey.trim();
  const selectedNewKeyOption = useMemo(
    () =>
      availableInputOptions.find((option) => option.key === trimmedNewKey) ??
      null,
    [availableInputOptions, trimmedNewKey]
  );

  const newKeySchema =
    selectedNewKeyOption?.schema ??
    (trimmedNewKey ? actionInputSchema?.[trimmedNewKey] : undefined);
  const newKeyNormalizedType = normalizeSchemaType(newKeySchema);
  const newKeyTypeLabel = buildTypeLabel(newKeySchema) || "String";
  const newKeyEnumOptions = extractEnumOptions(newKeySchema);

  return {
    actionInputSchema,
    actionInputOptions,
    inputEntries,
    usedInputKeys,
    availableInputOptions,
    trimmedNewKey,
    selectedNewKeyOption,
    newKeySchema,
    newKeyNormalizedType,
    newKeyTypeLabel,
    newKeyEnumOptions,
  };
};
