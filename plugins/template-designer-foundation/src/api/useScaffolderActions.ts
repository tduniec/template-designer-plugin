import { useEffect, useState } from "react";
import { useApiHolder } from "@backstage/core-plugin-api";
import { scaffolderApiRef } from "@backstage/plugin-scaffolder-react";
import type { ListActionsResponse } from "@backstage/plugin-scaffolder-common";
import { MOCK_SCAFFOLDER_ACTIONS } from "../utils/mocks/mocks";

type ScaffolderAction = {
  id: string;
  schema?: {
    input?: {
      properties?: Record<string, unknown>;
      required?: unknown;
    };
    output?: {
      properties?: Record<string, unknown>;
    };
  };
};

export type ScaffolderActionsCache = {
  ids: string[];
  inputsById: Record<string, Record<string, unknown>>;
  outputsById: Record<string, Record<string, unknown>>;
  inputRequiredById: Record<string, string[]>;
};

const buildCache = (list: ScaffolderAction[]): ScaffolderActionsCache => {
  const { inputsById, outputsById, inputRequiredById } = list.reduce<{
    inputsById: Record<string, Record<string, unknown>>;
    outputsById: Record<string, Record<string, unknown>>;
    inputRequiredById: Record<string, string[]>;
  }>(
    (acc, action) => {
      acc.inputsById[action.id] = action.schema?.input?.properties ?? {};
      acc.outputsById[action.id] = action.schema?.output?.properties ?? {};
      const required = Array.isArray(action.schema?.input?.required)
        ? action.schema?.input?.required.filter(
            (key): key is string =>
              typeof key === "string" && key.trim().length > 0
          )
        : [];
      acc.inputRequiredById[action.id] = required;
      return acc;
    },
    { inputsById: {}, outputsById: {}, inputRequiredById: {} }
  );

  return {
    ids: list.map((action) => action.id),
    inputsById,
    outputsById,
    inputRequiredById,
  };
};

const fallbackCache = buildCache(
  MOCK_SCAFFOLDER_ACTIONS as ListActionsResponse
);

export const useScaffolderActions = () => {
  const apiHolder = useApiHolder();
  const scaffolderApi = apiHolder.get(scaffolderApiRef);
  const [cache, setCache] = useState<ScaffolderActionsCache>(fallbackCache);

  useEffect(() => {
    let cancelled = false;

    if (!scaffolderApi) {
      setCache(fallbackCache);
      return () => {
        cancelled = true;
      };
    }

    scaffolderApi
      .listActions()
      .then((remoteActions) => {
        if (cancelled) {
          return;
        }
        setCache(buildCache(remoteActions));
      })
      .catch(() => {
        if (!cancelled) {
          setCache(fallbackCache);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [scaffolderApi]);

  return cache;
};
