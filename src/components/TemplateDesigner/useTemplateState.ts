import {
  ChangeEvent,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ScaffolderTaskOutput,
  TaskStep,
} from "@backstage/plugin-scaffolder-common";
import { TemplateEntityV1beta3 } from "@backstage/plugin-scaffolder-common";
import type { TemplateParametersValue } from "../Nodes/types";
import {
  convertJsonToYaml,
  convertYamlToJson,
} from "../../utils/yamlJsonConversion";
import { SAMPLE_TEMPLATE_BLUEPRINT } from "../../utils/sampleTemplate";
import {
  asRecord,
  cloneDeep,
  cloneSteps,
  DEFAULT_FILE_NAME,
  downloadString,
  FILE_PICKER_TYPES,
  FileSystemFileHandleLike,
  FileSystemWindow,
  isTaskStep,
  TemplateSource,
} from "./utils";
import { useApi } from "@backstage/core-plugin-api";
import { catalogApiRef } from "@backstage/plugin-catalog-react";

type TemplateState = {
  templateObject: Record<string, unknown> | null;
  templateYaml: string;
  yamlError?: string;
  loadError?: string;
  isDirty: boolean;
  templateSource?: TemplateSource;
  isReloading: boolean;
  isSaving: boolean;
  isSyncing: boolean;
  templateSteps: TaskStep[];
  templateParameters: TemplateParametersValue;
  templateOutput?: ScaffolderTaskOutput;
  fileInputRef: RefObject<HTMLInputElement>;
  handleStartSampleTemplate: () => void;
  handleTemplateFileSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  handleOpenTemplatePicker: () => void;
  handleYamlChange: (value: string) => void;
  handleStepsChange: (steps: TaskStep[]) => void;
  handleParametersChange: (parameters: TemplateParametersValue) => void;
  handleOutputChange: (output?: ScaffolderTaskOutput) => void;
  handleReloadFromFile: () => void;
  handleSaveTemplate: () => void;
  availableTemplates: TemplateEntityV1beta3[];
  selectCatalogTemplate: (selected: TemplateEntityV1beta3) => void;
};

const parseTemplateYaml = (value: string) => {
  const parsed = JSON.parse(convertYamlToJson(value));
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Template YAML must describe an object");
  }
  return parsed as Record<string, unknown>;
};

/**
 * Encapsulates the template designer data model including YAML parsing,
 * scaffolder spec updates, and file-system interactions.
 */
export const useTemplateState = (): TemplateState => {
  const [templateObject, setTemplateObject] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [templateYaml, setTemplateYaml] = useState("");
  const [yamlError, setYamlError] = useState<string | undefined>();
  const [loadError, setLoadError] = useState<string | undefined>();
  const [isDirty, setIsDirty] = useState(false);
  const [templateSource, setTemplateSource] = useState<
    TemplateSource | undefined
  >();
  const [isReloading, setIsReloading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const templateObjectRef = useRef<Record<string, unknown> | null>(null);
  const yamlParseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const yamlSerializeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const yamlParseIdleCancelRef = useRef<(() => void) | null>(null);
  const yamlSerializeIdleCancelRef = useRef<(() => void) | null>(null);
  const yamlParseCompletionRef = useRef<(() => void) | null>(null);
  const yamlSerializeCompletionRef = useRef<(() => void) | null>(null);
  const syncingCounterRef = useRef(0);
  const catalogApi = useApi(catalogApiRef);
  const [selectedTemplate, setSelectedTemplate] = useState<
    TemplateEntityV1beta3 | undefined
  >(undefined);
  const [availableTemplates, setAvailableTemplates] = useState<
    TemplateEntityV1beta3[]
  >([]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const ensureHandlePermission = useCallback(
    async (
      handle: FileSystemFileHandleLike | undefined,
      mode: "read" | "readwrite"
    ) => {
      if (!handle || !handle.queryPermission || !handle.requestPermission) {
        return true;
      }
      const options = { mode };
      const current = await handle.queryPermission(options);
      if (current === "granted") {
        return true;
      }
      const request = await handle.requestPermission(options);
      return request === "granted";
    },
    []
  );

  const applyTemplate = useCallback(
    (template: Record<string, unknown>, source: TemplateSource) => {
      const nextTemplate = cloneDeep(template);
      const nextYaml = convertJsonToYaml(nextTemplate);
      templateObjectRef.current = nextTemplate;
      setTemplateObject(nextTemplate);
      setTemplateYaml(nextYaml);
      setYamlError(undefined);
      setLoadError(undefined);
      setTemplateSource(source);
      setIsDirty(false);
    },
    []
  );

  const confirmDiscardChanges = useCallback(() => {
    if (!templateObject || !isDirty) {
      return true;
    }

    if (typeof window === "undefined") {
      return true;
    }

    // eslint-disable-next-line no-alert
    return window.confirm(
      "This will discard the changes you have made. Continue?"
    );
  }, [isDirty, templateObject]);

  const startSyncTask = useCallback(() => {
    syncingCounterRef.current += 1;
    if (syncingCounterRef.current === 1) {
      setIsSyncing(true);
    }
    return () => {
      syncingCounterRef.current = Math.max(syncingCounterRef.current - 1, 0);
      if (syncingCounterRef.current === 0) {
        setIsSyncing(false);
      }
    };
  }, []);

  const scheduleYamlParse = useCallback(
    (nextYaml: string) => {
      if (yamlParseTimeoutRef.current) {
        clearTimeout(yamlParseTimeoutRef.current);
      }
      if (yamlParseIdleCancelRef.current) {
        yamlParseIdleCancelRef.current();
        yamlParseIdleCancelRef.current = null;
      }
      if (yamlParseCompletionRef.current) {
        yamlParseCompletionRef.current();
        yamlParseCompletionRef.current = null;
      }
      yamlParseCompletionRef.current = startSyncTask();
      yamlParseTimeoutRef.current = setTimeout(() => {
        yamlParseTimeoutRef.current = null;
        const runParse = () => {
          try {
            const parsed = parseTemplateYaml(nextYaml);
            templateObjectRef.current = parsed;
            setTemplateObject(parsed);
            setYamlError(undefined);
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Unknown error parsing YAML";
            setYamlError(message);
          }
          if (yamlParseCompletionRef.current) {
            yamlParseCompletionRef.current();
            yamlParseCompletionRef.current = null;
          }
        };
        const idle =
          typeof window !== "undefined" &&
          typeof (window as any).requestIdleCallback === "function";
        if (idle) {
          const handle = (window as any).requestIdleCallback(runParse, {
            timeout: 800,
          });
          yamlParseIdleCancelRef.current = () => {
            (window as any).cancelIdleCallback?.(handle);
            if (yamlParseCompletionRef.current) {
              yamlParseCompletionRef.current();
              yamlParseCompletionRef.current = null;
            }
          };
          return;
        }
        runParse();
      }, 450);
    },
    [startSyncTask]
  );

  const scheduleYamlSerialization = useCallback(
    (nextTemplate: Record<string, unknown> | null | undefined) => {
      if (yamlSerializeTimeoutRef.current) {
        clearTimeout(yamlSerializeTimeoutRef.current);
      }
      if (yamlSerializeIdleCancelRef.current) {
        yamlSerializeIdleCancelRef.current();
        yamlSerializeIdleCancelRef.current = null;
      }
      if (yamlSerializeCompletionRef.current) {
        yamlSerializeCompletionRef.current();
        yamlSerializeCompletionRef.current = null;
      }
      yamlSerializeCompletionRef.current = startSyncTask();
      yamlSerializeTimeoutRef.current = setTimeout(() => {
        yamlSerializeTimeoutRef.current = null;
        if (!nextTemplate) {
          setTemplateYaml("");
          if (yamlSerializeCompletionRef.current) {
            yamlSerializeCompletionRef.current();
            yamlSerializeCompletionRef.current = null;
          }
          return;
        }
        const runSerialize = () => {
          try {
            setTemplateYaml(convertJsonToYaml(nextTemplate));
          } catch (error) {
            const message =
              error instanceof Error
                ? error.message
                : "Unknown error updating YAML";
            setLoadError(message);
          }
          if (yamlSerializeCompletionRef.current) {
            yamlSerializeCompletionRef.current();
            yamlSerializeCompletionRef.current = null;
          }
        };
        const idle =
          typeof window !== "undefined" &&
          typeof (window as any).requestIdleCallback === "function";
        if (idle) {
          const handle = (window as any).requestIdleCallback(runSerialize, {
            timeout: 800,
          });
          yamlSerializeIdleCancelRef.current = () => {
            (window as any).cancelIdleCallback?.(handle);
            if (yamlSerializeCompletionRef.current) {
              yamlSerializeCompletionRef.current();
              yamlSerializeCompletionRef.current = null;
            }
          };
          return;
        }
        runSerialize();
      }, 250);
    },
    [startSyncTask]
  );

  const flushPendingYamlSerialization = useCallback((): string => {
    if (yamlSerializeTimeoutRef.current) {
      clearTimeout(yamlSerializeTimeoutRef.current);
      yamlSerializeTimeoutRef.current = null;
    }
    if (yamlSerializeIdleCancelRef.current) {
      yamlSerializeIdleCancelRef.current();
      yamlSerializeIdleCancelRef.current = null;
    }
    if (yamlSerializeCompletionRef.current) {
      yamlSerializeCompletionRef.current();
      yamlSerializeCompletionRef.current = null;
    }
    const latest = templateObjectRef.current;
    if (!latest) {
      setTemplateYaml("");
      return "";
    }
    try {
      const serialized = convertJsonToYaml(latest);
      setTemplateYaml(serialized);
      return serialized;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error updating YAML";
      setLoadError(message);
      return templateYaml;
    }
  }, [templateYaml]);

  useEffect(() => {
    return () => {
      if (yamlParseTimeoutRef.current) {
        clearTimeout(yamlParseTimeoutRef.current);
      }
      if (yamlParseIdleCancelRef.current) {
        yamlParseIdleCancelRef.current();
      }
      if (yamlParseCompletionRef.current) {
        yamlParseCompletionRef.current();
        yamlParseCompletionRef.current = null;
      }
      if (yamlSerializeTimeoutRef.current) {
        clearTimeout(yamlSerializeTimeoutRef.current);
      }
      if (yamlSerializeIdleCancelRef.current) {
        yamlSerializeIdleCancelRef.current();
      }
      if (yamlSerializeCompletionRef.current) {
        yamlSerializeCompletionRef.current();
        yamlSerializeCompletionRef.current = null;
      }
      syncingCounterRef.current = 0;
      setIsSyncing(false);
    };
  }, []);

  useEffect(() => {
    templateObjectRef.current = templateObject;
  }, [templateObject]);

  const handleStartSampleTemplate = useCallback(() => {
    if (!confirmDiscardChanges()) {
      return;
    }
    applyTemplate(SAMPLE_TEMPLATE_BLUEPRINT, {
      type: "sample",
      label: "Sample template",
    });
  }, [applyTemplate, confirmDiscardChanges]);

  const handleTemplateFileSelected = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";

      if (!file) {
        return;
      }

      if (!confirmDiscardChanges()) {
        return;
      }

      try {
        const fileContents = await file.text();
        const parsed = parseTemplateYaml(fileContents);
        applyTemplate(parsed, {
          type: "file",
          label: file.name,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unknown error loading template";
        setLoadError(`Could not load template: ${message}`);
      }
    },
    [applyTemplate, confirmDiscardChanges]
  );

  const handleOpenTemplatePicker = useCallback(async () => {
    if (!confirmDiscardChanges()) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    const fsWindow = window as FileSystemWindow;

    if (fsWindow.showOpenFilePicker) {
      try {
        const handles = await fsWindow.showOpenFilePicker({
          multiple: false,
          types: FILE_PICKER_TYPES,
        });
        const [handle] = handles ?? [];
        if (!handle) {
          return;
        }

        const granted = await ensureHandlePermission(handle, "read");
        if (!granted) {
          setLoadError("Permission to read the selected file was denied.");
          return;
        }

        const file = await handle.getFile();
        const text = await file.text();
        const parsed = parseTemplateYaml(text);
        applyTemplate(parsed, {
          type: "file",
          label: handle.name ?? file.name,
          handle,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        const message =
          error instanceof Error
            ? error.message
            : "Unknown error loading template";
        setLoadError(`Could not load template: ${message}`);
      }
      return;
    }

    fileInputRef.current?.click();
  }, [applyTemplate, confirmDiscardChanges, ensureHandlePermission]);

  const templateSteps = useMemo(() => {
    if (!templateObject) {
      return [];
    }

    const template = asRecord(templateObject);
    if (!template) {
      return [];
    }

    const spec = asRecord(template.spec);
    if (!spec) {
      return [];
    }

    const maybeSteps = spec.steps;
    if (!Array.isArray(maybeSteps)) {
      return [];
    }

    const validSteps = maybeSteps.filter(isTaskStep) as TaskStep[];
    return cloneSteps(validSteps);
  }, [templateObject]);

  const templateParameters = useMemo((): TemplateParametersValue => {
    if (!templateObject) {
      return undefined;
    }

    const template = asRecord(templateObject);
    if (!template) {
      return undefined;
    }

    const spec = asRecord(template.spec);
    if (!spec) {
      return undefined;
    }

    if (!Object.prototype.hasOwnProperty.call(spec, "parameters")) {
      return undefined;
    }

    const rawParameters = (spec as Record<string, unknown>).parameters;
    if (rawParameters === undefined) {
      return undefined;
    }

    return cloneDeep(rawParameters as TemplateParametersValue);
  }, [templateObject]);

  const templateOutput = useMemo(() => {
    if (!templateObject) {
      return undefined;
    }

    const template = asRecord(templateObject);
    if (!template) {
      return undefined;
    }

    const spec = asRecord(template.spec);
    if (!spec) {
      return undefined;
    }

    const rawOutput = spec.output;
    if (!rawOutput || typeof rawOutput !== "object") {
      return undefined;
    }

    return cloneDeep(rawOutput as ScaffolderTaskOutput);
  }, [templateObject]);

  const handleYamlChange = useCallback(
    (value: string) => {
      setTemplateYaml(value);
      setIsDirty(true);
      scheduleYamlParse(value);
    },
    [scheduleYamlParse]
  );

  const handleStepsChange = useCallback(
    (steps: TaskStep[]) => {
      setIsDirty(true);
      setTemplateObject((prevTemplate) => {
        const base =
          prevTemplate && typeof prevTemplate === "object"
            ? (cloneDeep(prevTemplate) as Record<string, unknown>)
            : ({} as Record<string, unknown>);

        const spec = asRecord(base.spec) ?? {};
        const nextSteps = cloneSteps(steps);

        const nextTemplate: Record<string, unknown> = {
          ...base,
          spec: {
            ...spec,
            steps: nextSteps,
          },
        };

        templateObjectRef.current = nextTemplate;
        scheduleYamlSerialization(nextTemplate);
        return nextTemplate;
      });
    },
    [scheduleYamlSerialization]
  );

  const handleParametersChange = useCallback(
    (parameters: TemplateParametersValue) => {
      setIsDirty(true);
      setTemplateObject((prevTemplate) => {
        const base =
          prevTemplate && typeof prevTemplate === "object"
            ? (cloneDeep(prevTemplate) as Record<string, unknown>)
            : ({} as Record<string, unknown>);

        const spec = asRecord(base.spec) ?? {};
        const nextTemplate: Record<string, unknown> = {
          ...base,
          spec: {
            ...spec,
            parameters: cloneDeep(parameters),
          },
        };

        templateObjectRef.current = nextTemplate;
        scheduleYamlSerialization(nextTemplate);
        return nextTemplate;
      });
    },
    [scheduleYamlSerialization]
  );

  const handleOutputChange = useCallback(
    (output?: ScaffolderTaskOutput) => {
      setIsDirty(true);
      setTemplateObject((prevTemplate) => {
        const base =
          prevTemplate && typeof prevTemplate === "object"
            ? (cloneDeep(prevTemplate) as Record<string, unknown>)
            : ({} as Record<string, unknown>);

        const spec = asRecord(base.spec) ?? {};
        const nextTemplate: Record<string, unknown> = {
          ...base,
          spec: {
            ...spec,
            output: cloneDeep(output),
          },
        };

        templateObjectRef.current = nextTemplate;
        scheduleYamlSerialization(nextTemplate);
        return nextTemplate;
      });
    },
    [scheduleYamlSerialization]
  );

  const handleReloadFromFile = useCallback(async () => {
    if (!templateSource) {
      return;
    }

    if (templateSource.type === "catalog") {
      if (selectedTemplate) {
        applyTemplate(selectedTemplate as unknown as Record<string, unknown>, {
          type: "catalog",
          label:
            selectedTemplate.metadata.title ?? selectedTemplate.metadata.name,
        });
      }
      return;
    }
    if (templateSource.type !== "file") {
      handleStartSampleTemplate();
      return;
    }

    if (!templateSource.handle) {
      handleOpenTemplatePicker();
      return;
    }

    if (!confirmDiscardChanges()) {
      return;
    }

    try {
      setIsReloading(true);
      const granted = await ensureHandlePermission(
        templateSource.handle,
        "read"
      );
      if (!granted) {
        setLoadError("Permission to read the selected file was denied.");
        return;
      }

      const file = await templateSource.handle.getFile();
      const text = await file.text();
      const parsed = parseTemplateYaml(text);
      applyTemplate(parsed, {
        type: "file",
        label: templateSource.handle.name ?? file.name ?? templateSource.label,
        handle: templateSource.handle,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error reloading template";
      setLoadError(`Could not reload template: ${message}`);
    } finally {
      setIsReloading(false);
    }
  }, [
    applyTemplate,
    confirmDiscardChanges,
    ensureHandlePermission,
    handleOpenTemplatePicker,
    handleStartSampleTemplate,
    selectedTemplate,
    templateSource,
  ]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateObject) {
      return;
    }

    const yamlToPersist = flushPendingYamlSerialization();

    if (typeof window === "undefined") {
      downloadString(yamlToPersist, DEFAULT_FILE_NAME);
      setIsDirty(false);
      return;
    }

    try {
      setIsSaving(true);
      setLoadError(undefined);
      const fsWindow = window as FileSystemWindow;

      if (templateSource?.type === "file" && templateSource.handle) {
        const granted = await ensureHandlePermission(
          templateSource.handle,
          "readwrite"
        );
        if (!granted) {
          setLoadError("Permission to save to the selected file was denied.");
          return;
        }
        const writable = await templateSource.handle.createWritable?.();
        if (!writable) {
          throw new Error("Unable to open file for writing.");
        }
        await writable.write(yamlToPersist);
        await writable.close();
        setIsDirty(false);
        return;
      }

      if (fsWindow.showSaveFilePicker) {
        const handle = await fsWindow.showSaveFilePicker({
          suggestedName: templateSource?.label ?? DEFAULT_FILE_NAME,
          types: FILE_PICKER_TYPES,
        });
        const writable = await handle.createWritable?.();
        if (!writable) {
          throw new Error("Unable to open file for writing.");
        }
        await writable.write(yamlToPersist);
        await writable.close();
        setTemplateSource({
          type: "file",
          label: handle.name ?? templateSource?.label ?? DEFAULT_FILE_NAME,
          handle,
        });
        setIsDirty(false);
        return;
      }

      downloadString(yamlToPersist, templateSource?.label ?? DEFAULT_FILE_NAME);
      setIsDirty(false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unknown error saving template";
      setLoadError(`Failed to save template: ${message}`);
    } finally {
      setIsSaving(false);
    }
  }, [
    ensureHandlePermission,
    flushPendingYamlSerialization,
    templateObject,
    templateSource,
  ]);

  useEffect(() => {
    catalogApi
      .getEntities({
        filter: {
          kind: "Template",
        },
      })
      .then((data) => {
        setAvailableTemplates(data.items as TemplateEntityV1beta3[]);
      })
      .catch(() => setAvailableTemplates([]));
  }, [catalogApi]);

  const selectCatalogTemplate = useCallback(
    (selected: TemplateEntityV1beta3) => {
      setSelectedTemplate(selected);
      applyTemplate(selected as unknown as Record<string, unknown>, {
        type: "catalog",
        label: selected.metadata.title ?? selected.metadata.name,
      });
    },
    [applyTemplate]
  );

  return {
    templateObject,
    templateYaml,
    yamlError,
    loadError,
    isDirty,
    templateSource,
    isReloading,
    isSaving,
    isSyncing,
    templateSteps,
    templateParameters,
    templateOutput,
    fileInputRef,
    handleStartSampleTemplate,
    handleTemplateFileSelected,
    handleOpenTemplatePicker,
    handleYamlChange,
    handleStepsChange,
    handleParametersChange,
    handleOutputChange,
    handleReloadFromFile,
    handleSaveTemplate,
    availableTemplates,
    selectCatalogTemplate,
  };
};
