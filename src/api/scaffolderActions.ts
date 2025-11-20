import { useEffect, useState } from "react";
import { useApiHolder } from "@backstage/core-plugin-api";
import { scaffolderApiRef } from "@backstage/plugin-scaffolder-react";
import { MOCK_SCAFFOLDER_ACTIONS } from "./mockScaffolderActions";

// Encapsulated hook for loading/caching scaffolder action metadata.

type ScaffolderAction = {
  id: string;
  schema?: {
    input?: {
      properties?: Record<string, unknown>;
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
};

const buildCache = (list: ScaffolderAction[]): ScaffolderActionsCache => {
  const { inputsById, outputsById } = list.reduce<{
    inputsById: Record<string, Record<string, unknown>>;
    outputsById: Record<string, Record<string, unknown>>;
  }>(
    (acc, action) => {
      acc.inputsById[action.id] = action.schema?.input?.properties ?? {};
      acc.outputsById[action.id] = action.schema?.output?.properties ?? {};
      return acc;
    },
    { inputsById: {}, outputsById: {} }
  );

  return {
    ids: list.map((action) => action.id),
    inputsById,
    outputsById,
  };
};

const fallbackCache = buildCache(MOCK_SCAFFOLDER_ACTIONS);

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
