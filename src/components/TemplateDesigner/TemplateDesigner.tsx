import { ChangeEvent, useCallback, useMemo, useRef, useState } from "react";
import {
  Page,
  Content,
  ContentHeader,
  SupportButton,
} from "@backstage/core-components";
import App from "../DesignerFlow/DesignerFlow";
import { Box, Button, Grid, Paper, Typography } from "@material-ui/core";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import {
  convertJsonToYaml,
  convertYamlToJson,
} from "../../utils/yamlJsonConversion";
import { useTheme } from "@material-ui/core/styles";
import type { TaskStep } from "@backstage/plugin-scaffolder-common";
import { SAMPLE_TEMPLATE_BLUEPRINT } from "../../utils/sampleTemplate";

const FILE_PICKER_ACCEPT = {
  "application/yaml": [".yaml", ".yml"],
  "application/json": [".json"],
};

const FILE_PICKER_TYPES = [
  {
    description: "Scaffolder template",
    accept: FILE_PICKER_ACCEPT,
  },
];

const DEFAULT_FILE_NAME = "template.yaml";

const isTaskStep = (candidate: unknown): candidate is TaskStep => {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }
  const step = candidate as Record<string, unknown>;
  return (
    typeof step.id === "string" &&
    typeof step.name === "string" &&
    typeof step.action === "string"
  );
};

const cloneDeep = <T,>(value: T): T => {
  if (value === undefined || value === null) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

const cloneSteps = (steps: TaskStep[]): TaskStep[] =>
  steps.map((step) => cloneDeep(step));

const asRecord = (candidate: unknown): Record<string, unknown> | undefined => {
  if (!candidate || typeof candidate !== "object") {
    return undefined;
  }
  return candidate as Record<string, unknown>;
};

const downloadString = (value: string, fileName: string) => {
  const blob = new Blob([value], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

type FileSystemFileHandleLike = {
  name?: string;
  getFile: () => Promise<File>;
  createWritable?: () => Promise<{
    write: (data: Blob | string) => Promise<void>;
    close: () => Promise<void>;
  }>;
  queryPermission?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
  requestPermission?: (options?: {
    mode?: "read" | "readwrite";
  }) => Promise<PermissionState>;
};

type TemplateSource =
  | { type: "sample"; label: string }
  | { type: "file"; label: string; handle?: FileSystemFileHandleLike };

type FileSystemWindow = Window &
  Partial<{
    showOpenFilePicker: (
      options?: unknown
    ) => Promise<FileSystemFileHandleLike[]>;
    showSaveFilePicker: (
      options?: unknown
    ) => Promise<FileSystemFileHandleLike>;
  }>;

export const TemplateDesigner = () => {
  const [showYaml, setShowYaml] = useState(true);
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

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const theme = useTheme();

  const yamlExtensions = useMemo(() => [yaml()], []);
  const codeMirrorTheme = useMemo(
    () => (theme.palette.type === "dark" ? "dark" : "light"),
    [theme.palette.type]
  );

  const parseTemplateYaml = useCallback((value: string) => {
    const parsed = JSON.parse(convertYamlToJson(value));
    if (!parsed || typeof parsed !== "object") {
      throw new Error("Template YAML must describe an object");
    }
    return parsed as Record<string, unknown>;
  }, []);

  const ensureHandlePermission = useCallback(
    async (handle: FileSystemFileHandleLike, mode: "read" | "readwrite") => {
      if (!handle.queryPermission || !handle.requestPermission) {
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
    [applyTemplate, confirmDiscardChanges, parseTemplateYaml]
  );

  const handleToggleYaml = useCallback(() => setShowYaml((prev) => !prev), []);

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
  }, [
    applyTemplate,
    confirmDiscardChanges,
    ensureHandlePermission,
    parseTemplateYaml,
  ]);

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

  const handleYamlChange = useCallback(
    (value: string) => {
      setTemplateYaml(value);
      setIsDirty(true);
      try {
        const parsed = parseTemplateYaml(value);
        setTemplateObject(parsed);
        setYamlError(undefined);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error parsing YAML";
        setYamlError(message);
      }
    },
    [parseTemplateYaml]
  );

  const handleStepsChange = useCallback((steps: TaskStep[]) => {
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

      const nextYaml = convertJsonToYaml(nextTemplate);
      setTemplateYaml(nextYaml);
      setYamlError(undefined);
      return nextTemplate;
    });
  }, []);

  const handleReloadFromFile = useCallback(async () => {
    if (!templateSource) {
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
    parseTemplateYaml,
    templateSource,
  ]);

  const handleSaveTemplate = useCallback(async () => {
    if (!templateObject) {
      return;
    }

    if (typeof window === "undefined") {
      downloadString(templateYaml, DEFAULT_FILE_NAME);
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
        await writable.write(templateYaml);
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
        await writable.write(templateYaml);
        await writable.close();
        setTemplateSource({
          type: "file",
          label: handle.name ?? templateSource?.label ?? DEFAULT_FILE_NAME,
          handle,
        });
        setIsDirty(false);
        return;
      }

      downloadString(templateYaml, templateSource?.label ?? DEFAULT_FILE_NAME);
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
  }, [ensureHandlePermission, templateObject, templateSource, templateYaml]);

  const activeTemplateLabel = templateSource?.label;

  let reloadButtonLabel = "Reset sample";
  if (templateSource?.type === "file") {
    reloadButtonLabel = isReloading ? "Reloading..." : "Reload file";
  }

  let saveButtonLabel =
    templateSource?.type === "file" ? "Save" : "Save as file";
  if (isSaving) {
    saveButtonLabel = "Saving...";
  }

  return (
    <Page themeId="tool">
      <Content>
        <ContentHeader title="Template Designer">
          <SupportButton>A description of your plugin goes here.</SupportButton>
        </ContentHeader>

        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml,.json"
          style={{ display: "none" }}
          onChange={handleTemplateFileSelected}
        />

        {!templateObject ? (
          <Grid
            container
            justifyContent="center"
            alignItems="center"
            style={{ minHeight: "60vh" }}
          >
            <Grid item xs={12} md={10} lg={8}>
              <Grid container spacing={4} alignItems="stretch">
                <Grid item xs={12} md={6}>
                  <Paper
                    elevation={3}
                    style={{
                      padding: 32,
                      height: "100%",
                      minHeight: 320,
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <Box>
                      <Typography variant="h6">Create new template</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Start with a tidy sample blueprint that includes a
                        single action step and some helpful starter metadata.
                      </Typography>
                    </Box>
                    <Box mt="auto" display="flex" justifyContent="flex-start">
                      <Button
                        color="primary"
                        variant="contained"
                        onClick={handleStartSampleTemplate}
                      >
                        Start new template
                      </Button>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Paper
                    elevation={3}
                    style={{
                      padding: 32,
                      height: "100%",
                      minHeight: 320,
                      display: "flex",
                      flexDirection: "column",
                      gap: 16,
                    }}
                  >
                    <Box>
                      <Typography variant="h6">Load from file</Typography>
                      <Typography variant="body2" color="textSecondary">
                        Import an existing template in YAML or JSON format and
                        keep iterating in the visual designer.
                      </Typography>
                    </Box>
                    <Box
                      mt="auto"
                      display="flex"
                      flexDirection="column"
                      style={{ gap: 8 }}
                    >
                      <Button
                        color="primary"
                        variant="outlined"
                        onClick={handleOpenTemplatePicker}
                      >
                        Choose file
                      </Button>
                      {loadError && (
                        <Typography
                          variant="body2"
                          style={{ color: theme.palette.error.main }}
                        >
                          {loadError}
                        </Typography>
                      )}
                    </Box>
                  </Paper>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        ) : (
          <Grid container spacing={3} direction="column">
            <Grid style={{ height: 800 }} item>
              <div
                style={{
                  height: "100%",
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    {activeTemplateLabel && (
                      <Typography variant="body2" color="textSecondary">
                        Active template: {activeTemplateLabel}
                      </Typography>
                    )}
                    <Button
                      color="primary"
                      variant="contained"
                      size="small"
                      onClick={handleReloadFromFile}
                      disabled={isReloading}
                    >
                      {reloadButtonLabel}
                    </Button>
                    <Button
                      color="primary"
                      variant="outlined"
                      size="small"
                      onClick={handleSaveTemplate}
                      disabled={isSaving}
                    >
                      {saveButtonLabel}
                    </Button>
                    <Button
                      color="primary"
                      variant="outlined"
                      size="small"
                      onClick={handleOpenTemplatePicker}
                    >
                      Load different file
                    </Button>
                  </div>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleToggleYaml}
                  >
                    {showYaml ? "Hide YAML" : "Show YAML"}
                  </Button>
                </div>
                {loadError && (
                  <Typography
                    variant="body2"
                    style={{ color: theme.palette.error.main }}
                  >
                    {loadError}
                  </Typography>
                )}
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    gap: 16,
                    minHeight: 0,
                  }}
                >
                  <div style={{ flex: showYaml ? 1.6 : 1, minWidth: 0 }}>
                    <div style={{ height: "100%" }}>
                      <App
                        steps={templateSteps}
                        onStepsChange={handleStepsChange}
                      />
                    </div>
                  </div>
                  {showYaml && (
                    <Paper
                      elevation={2}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid rgba(0,0,0,0.12)",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        }}
                      >
                        YAML Preview
                      </div>
                      {yamlError && (
                        <div
                          style={{
                            padding: "8px 16px",
                            borderBottom: "1px solid rgba(0,0,0,0.08)",
                            color: theme.palette.error.main,
                            fontSize: "0.75rem",
                            background:
                              theme.palette.type === "dark"
                                ? "rgba(255, 82, 82, 0.1)"
                                : "rgba(244, 67, 54, 0.08)",
                          }}
                        >
                          {yamlError}
                        </div>
                      )}
                      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                        <CodeMirror
                          value={templateYaml}
                          extensions={yamlExtensions}
                          theme={codeMirrorTheme}
                          height="100%"
                          onChange={handleYamlChange}
                        />
                      </div>
                    </Paper>
                  )}
                </div>
              </div>
            </Grid>
          </Grid>
        )}
      </Content>
    </Page>
  );
};
