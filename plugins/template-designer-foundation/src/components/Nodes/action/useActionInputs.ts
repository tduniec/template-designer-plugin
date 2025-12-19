import { useMemo } from "react";
import type { TaskStep } from "@backstage/plugin-scaffolder-common";
import type { ActionNodeData } from "../../../types/flowNodes";
import {
  actionNodeCustomizationRegistry,
  type ActionSchemaDecorator,
} from "../../../foundation/actionNodeCustomization";
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
  const schemaDecorators = useMemo<ActionSchemaDecorator[]>(
    () => actionNodeCustomizationRegistry.getSchemaDecorators(),
    []
  );

  const actionInputSchema = useMemo(() => {
    if (!actionId) {
      return {} as Record<string, JsonSchemaProperty>;
    }
    const baseSchema = (data.scaffolderActionInputsById?.[actionId] ??
      {}) as Record<string, JsonSchemaProperty>;
    return schemaDecorators.reduce(
      (acc, decorator) => decorator({ actionId, step, schema: acc }) ?? acc,
      baseSchema
    );
  }, [actionId, data.scaffolderActionInputsById, schemaDecorators, step]);

  const inputEntries = useMemo(() => {
    const stepInput = step?.input ?? {};
    return Object.entries(stepInput);
  }, [step?.input]);

  const usedInputKeys = useMemo(
    () => new Set(inputEntries.map(([key]) => key)),
    [inputEntries]
  );

  const missingRequiredInputKeys = useMemo(() => {
    const requiredKeys =
      data.scaffolderActionInputRequiredById?.[actionId] ?? [];
    return requiredKeys.filter((key) => !usedInputKeys.has(key));
  }, [actionId, data.scaffolderActionInputRequiredById, usedInputKeys]);

  const availableInputOptions = useMemo<ActionInputOption[]>(() => {
    const options = Object.entries(actionInputSchema ?? {})
      .filter(([key]) => !usedInputKeys.has(key))
      .map(([key, schema]) => {
        const typedSchema = schema as JsonSchemaProperty | undefined;
        return {
          key,
          label: `${key} (${buildTypeLabel(typedSchema) || "string"})`,
          schema: typedSchema,
          type: normalizeSchemaType(typedSchema),
        };
      });
    return options;
  }, [actionInputSchema, usedInputKeys]);

  const trimmedNewKey = newKey.trim();
  const selectedNewKeyOption =
    availableInputOptions.find((opt) => opt.key === trimmedNewKey) ?? null;
  const newKeyNormalizedType = normalizeSchemaType(
    selectedNewKeyOption?.schema
  );
  const newKeyTypeLabel = buildTypeLabel(selectedNewKeyOption?.schema);
  const newKeyEnumOptions = extractEnumOptions(selectedNewKeyOption?.schema);

  return {
    actionInputSchema,
    inputEntries,
    usedInputKeys,
    missingRequiredInputKeys,
    availableInputOptions,
    trimmedNewKey,
    selectedNewKeyOption,
    newKeyNormalizedType,
    newKeyTypeLabel,
    newKeyEnumOptions,
  };
};
