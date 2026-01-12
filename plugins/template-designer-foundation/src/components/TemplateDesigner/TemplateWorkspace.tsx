import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Button,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  IconButton,
  Tooltip,
} from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import {
  TEMPLATE_DESIGNER_CM_CLASS,
  createCodeMirrorTheme,
} from "./codemirrorTheme";
import type {
  ScaffolderTaskOutput,
  TaskStep,
} from "@backstage/plugin-scaffolder-common";
import type { TemplateParametersValue } from "../../types/flowNodes";
import DesignerFlow, {
  type DesignerFlowProps,
} from "../../designerFlow/DesignerFlow";
import { ActionNode } from "../Nodes/ActionNode";
import { OutputNode } from "../Nodes/OutputNode";
import ChevronLeft from "@material-ui/icons/ChevronLeft";
import ChevronRight from "@material-ui/icons/ChevronRight";

type TemplateWorkspaceProps = {
  templateSteps: TaskStep[];
  templateParameters: TemplateParametersValue;
  templateOutput?: ScaffolderTaskOutput;
  templateYaml: string;
  yamlError?: string;
  loadError?: string;
  showYaml: boolean;
  onToggleYaml: () => void;
  onYamlChange: (value: string) => void;
  onStepsChange: (steps: TaskStep[]) => void;
  onParametersChange: (parameters: TemplateParametersValue) => void;
  onOutputChange: (output?: ScaffolderTaskOutput) => void;
  onReload: () => void;
  onSave: () => void;
  onOpenTemplatePicker: () => void;
  activeTemplateLabel?: string;
  reloadButtonLabel: string;
  saveButtonLabel: string;
  isReloading: boolean;
  isSaving: boolean;
  isSyncing?: boolean;
  parametersNodeComponent: DesignerFlowProps["parametersNodeComponent"];
  actionNodeComponent?: DesignerFlowProps["actionNodeComponent"];
  outputNodeComponent?: DesignerFlowProps["outputNodeComponent"];
  headerActionsSlot?: ReactNode;
  primaryActionsSlot?: ReactNode;
  flowTopSlot?: ReactNode;
  rightPanelSlot?: ReactNode;
  leftSidebar?: ReactNode;
  leftSidebarCollapsible?: boolean;
  leftSidebarInitialExpanded?: boolean;
  editorOverride?: {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    onSave?: () => void;
    filePath?: string;
    isDirty?: boolean;
    isSaving?: boolean;
  };
  hideLoadFileButton?: boolean;
  loadFileButtonLabel?: string;
};

export const TemplateWorkspace = ({
  templateSteps,
  templateParameters,
  templateOutput,
  templateYaml,
  yamlError,
  loadError,
  showYaml,
  onToggleYaml,
  onYamlChange,
  onStepsChange,
  onParametersChange,
  onOutputChange,
  onReload,
  onSave,
  onOpenTemplatePicker,
  activeTemplateLabel,
  reloadButtonLabel,
  saveButtonLabel,
  isReloading,
  isSaving,
  isSyncing = false,
  parametersNodeComponent,
  actionNodeComponent = ActionNode as DesignerFlowProps["actionNodeComponent"],
  outputNodeComponent = OutputNode as DesignerFlowProps["outputNodeComponent"],
  headerActionsSlot,
  primaryActionsSlot,
  flowTopSlot,
  rightPanelSlot,
  leftSidebar,
  leftSidebarCollapsible = false,
  leftSidebarInitialExpanded = true,
  editorOverride,
  hideLoadFileButton = false,
  loadFileButtonLabel = "Load different file",
}: TemplateWorkspaceProps) => {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [workspaceHeight, setWorkspaceHeight] = useState<number | null>(null);
  const theme = useTheme();
  const paletteMode =
    (theme.palette as { mode?: "light" | "dark" }).mode ??
    theme.palette.type ??
    "light";
  const yamlDraftRef = useRef(templateYaml);
  const templateYamlRef = useRef(templateYaml);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastGoodFlowModelRef = useRef<{
    steps: TaskStep[];
    parameters: TemplateParametersValue;
    output?: ScaffolderTaskOutput;
  }>({
    steps: templateSteps,
    parameters: templateParameters,
    output: templateOutput,
  });
  const [debouncedFlowModel, setDebouncedFlowModel] = useState<{
    steps: TaskStep[];
    parameters: TemplateParametersValue;
    output?: ScaffolderTaskOutput;
  }>({
    steps: templateSteps,
    parameters: templateParameters,
    output: templateOutput,
  });
  const yamlExtensions = useMemo(() => [yaml()], []);
  const codeMirrorTheme = useMemo(
    () => createCodeMirrorTheme(theme, paletteMode),
    [paletteMode, theme]
  );

  const flushYamlDraft = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (yamlDraftRef.current !== templateYamlRef.current) {
      onYamlChange(yamlDraftRef.current);
    }
  }, [onYamlChange]);

  const handleYamlChange = useCallback(
    (value: string) => {
      yamlDraftRef.current = value;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        if (yamlDraftRef.current !== templateYamlRef.current) {
          onYamlChange(yamlDraftRef.current);
        }
        debounceRef.current = null;
      }, 600); // Send YAML updates after user pauses; avoids live sync on every keystroke.
    },
    [onYamlChange]
  );

  const flushFlowDebounce = useCallback(() => {
    if (flowDebounceRef.current) {
      clearTimeout(flowDebounceRef.current);
      flowDebounceRef.current = null;
    }
    // Push latest parsable props immediately; used when user clicks out.
    if (!yamlError) {
      lastGoodFlowModelRef.current = {
        steps: templateSteps,
        parameters: templateParameters,
        output: templateOutput,
      };
    }
    setDebouncedFlowModel(lastGoodFlowModelRef.current);
  }, [templateParameters, templateSteps, templateOutput, yamlError]);

  const handleYamlBlur = useCallback(() => {
    flushYamlDraft();
    // Ensure pending graph updates flush when user leaves the editor.
    flushFlowDebounce();
  }, [flushFlowDebounce, flushYamlDraft]);

  const handleSaveClick = useCallback(() => {
    // Push any pending editor changes before saving.
    flushYamlDraft();
    flushFlowDebounce();
    if (editorOverride?.onSave) {
      editorOverride.onSave();
      return;
    }
    onSave();
  }, [editorOverride, flushFlowDebounce, flushYamlDraft, onSave]);

  const editorValue = editorOverride?.value ?? templateYaml;
  const editorOnChange = editorOverride?.onChange ?? handleYamlChange;
  const editorOnBlur = editorOverride?.onBlur ?? handleYamlBlur;
  const hideFlow =
    editorOverride?.filePath && !/\.ya?ml$/i.test(editorOverride.filePath);

  const [isSidebarExpanded, setIsSidebarExpanded] = useState(
    leftSidebarInitialExpanded
  );

  useEffect(() => {
    // Keep the last good (parsable) model so YAML drafts with errors don't blank the canvas.
    if (!yamlError) {
      lastGoodFlowModelRef.current = {
        steps: templateSteps,
        parameters: templateParameters,
        output: templateOutput,
      };
    }
    if (flowDebounceRef.current) {
      clearTimeout(flowDebounceRef.current);
    }
    // Debounce to avoid re-rendering the graph on every keystroke in YAML/editor.
    flowDebounceRef.current = setTimeout(() => {
      // If YAML is broken, keep showing the last good model instead of empty graph.
      setDebouncedFlowModel(lastGoodFlowModelRef.current);
      flowDebounceRef.current = null;
    }, 400);
  }, [templateParameters, templateSteps, templateOutput, yamlError]);

  useEffect(() => {
    yamlDraftRef.current = templateYaml;
    templateYamlRef.current = templateYaml;
  }, [templateYaml]);

  useEffect(() => {
    if (!showYaml) {
      flushYamlDraft();
    }
  }, [showYaml, flushYamlDraft]);

  useEffect(
    () => () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (flowDebounceRef.current) {
        clearTimeout(flowDebounceRef.current);
      }
      flushYamlDraft();
    },
    [flushYamlDraft]
  );

  const recalcWorkspaceHeight = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }
    const node = workspaceRef.current;
    if (!node) {
      return;
    }
    const rect = node.getBoundingClientRect();
    const available = window.innerHeight - rect.top - 16;
    setWorkspaceHeight(Math.max(available, 320));
  }, []);

  useEffect(() => {
    recalcWorkspaceHeight();
    if (typeof window === "undefined") {
      return undefined;
    }
    const handleResize = () => recalcWorkspaceHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [recalcWorkspaceHeight]);

  return (
    <div
      ref={workspaceRef}
      style={{
        position: "relative",
        height: workspaceHeight ? `${workspaceHeight}px` : "100vh",
        minHeight: 0,
      }}
    >
      {isSyncing && (
        <div
          style={{
            position: "fixed",
            left: "calc(72px + 160px)",
            bottom: 24,
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "6px 10px",
            borderRadius: 8,
            background:
              paletteMode === "dark"
                ? "rgba(33,33,33,0.9)"
                : "rgba(255,255,255,0.95)",
            boxShadow: theme.shadows[3],
            border: `1px solid ${theme.palette.divider}`,
            zIndex: (theme.zIndex?.tooltip ?? 1500) + 1,
            pointerEvents: "none",
          }}
        >
          <CircularProgress size={16} thickness={5} color="primary" />
          <Typography variant="caption" color="textSecondary">
            Syncing...
          </Typography>
        </div>
      )}
      <Grid container spacing={3} direction="column" style={{ height: "100%" }}>
        <Grid item style={{ height: "100%" }}>
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
                  onClick={onReload}
                  disabled={isReloading}
                >
                  {reloadButtonLabel}
                </Button>
                <Button
                  color="primary"
                  variant="outlined"
                  size="small"
                  onClick={handleSaveClick}
                  disabled={isSaving}
                >
                  {saveButtonLabel}
                </Button>
                {!hideLoadFileButton ? (
                  <Button
                    color="primary"
                    variant="outlined"
                    size="small"
                    onClick={onOpenTemplatePicker}
                  >
                    {loadFileButtonLabel}
                  </Button>
                ) : null}
                {primaryActionsSlot ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {primaryActionsSlot}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Button variant="outlined" size="small" onClick={onToggleYaml}>
                  {showYaml ? "Hide YAML" : "Show YAML"}
                </Button>
              </div>
            </div>
            {loadError && (
              <Typography
                variant="body2"
                style={{ color: theme.palette.error.main }}
              >
                {loadError}
              </Typography>
            )}
            {headerActionsSlot && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                {headerActionsSlot}
              </div>
            )}
            <div
              style={{
                flex: 1,
                display: "flex",
                gap: 16,
                minHeight: 0,
                height: "100%",
              }}
            >
              {leftSidebar ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 8,
                  }}
                >
                  {isSidebarExpanded ? (
                    <Paper
                      elevation={1}
                      style={{
                        width: 280,
                        minWidth: 240,
                        maxWidth: 360,
                        borderRadius: 8,
                        overflow: "hidden",
                        display: "flex",
                        flexDirection: "column",
                        position: "relative",
                      }}
                    >
                      {leftSidebar}
                    </Paper>
                  ) : null}
                  {leftSidebarCollapsible ? (
                    <Tooltip
                      title={
                        isSidebarExpanded ? "Hide workspace" : "Show workspace"
                      }
                      placement="left"
                    >
                      <IconButton
                        size="small"
                        onClick={() =>
                          setIsSidebarExpanded((expanded) => !expanded)
                        }
                        style={{
                          border: `1px solid ${theme.palette.divider}`,
                          height: 36,
                          width: 36,
                          borderRadius: "50%",
                          alignSelf: "flex-start",
                        }}
                      >
                        {isSidebarExpanded ? <ChevronLeft /> : <ChevronRight />}
                      </IconButton>
                    </Tooltip>
                  ) : null}
                </div>
              ) : null}
              <div
                style={{
                  flex: showYaml ? 1 : 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ flex: 1, minHeight: 0 }}>
                  {flowTopSlot}
                  {hideFlow ? (
                    <Paper
                      variant="outlined"
                      style={{
                        padding: 16,
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Typography variant="body2" color="textSecondary">
                        Open a YAML scaffolder file to render the graph.
                      </Typography>
                    </Paper>
                  ) : (
                    <DesignerFlow
                      steps={debouncedFlowModel.steps}
                      parameters={debouncedFlowModel.parameters}
                      output={debouncedFlowModel.output}
                      onStepsChange={onStepsChange}
                      onParametersChange={onParametersChange}
                      onOutputChange={onOutputChange}
                      actionNodeComponent={actionNodeComponent}
                      parametersNodeComponent={parametersNodeComponent}
                      outputNodeComponent={outputNodeComponent}
                    />
                  )}
                </div>
              </div>
              {(showYaml || rightPanelSlot) && (
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
                  {showYaml && (
                    <>
                      <div
                        style={{
                          padding: "12px 16px",
                          borderBottom: "1px solid rgba(0,0,0,0.12)",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                        }}
                      >
                        {editorOverride?.filePath
                          ? `File: ${editorOverride.filePath}`
                          : "YAML Preview"}
                        {editorOverride?.isDirty ? (
                          <span
                            style={{
                              marginLeft: 8,
                              color: theme.palette.warning.main,
                            }}
                          >
                            • Unsaved
                          </span>
                        ) : null}
                        {editorOverride?.isSaving ? (
                          <span
                            style={{
                              marginLeft: 8,
                              color: theme.palette.text.secondary,
                              fontSize: "0.75rem",
                            }}
                          >
                            Saving...
                          </span>
                        ) : null}
                        {editorOverride?.onSave ? (
                          <Button
                            size="small"
                            variant="outlined"
                            color="primary"
                            style={{ marginLeft: 12 }}
                            onClick={handleSaveClick}
                            disabled={editorOverride.isSaving}
                          >
                            Save
                          </Button>
                        ) : null}
                      </div>
                      {yamlError && (
                        <div
                          style={{
                            padding: "8px 16px",
                            borderBottom: "1px solid rgba(0,0,0,0.08)",
                            color: theme.palette.error.main,
                            fontSize: "0.75rem",
                            background:
                              paletteMode === "dark"
                                ? "rgba(255, 82, 82, 0.1)"
                                : "rgba(244, 67, 54, 0.08)",
                          }}
                        >
                          {yamlError}
                        </div>
                      )}
                      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                        <CodeMirror
                          value={editorValue}
                          extensions={yamlExtensions}
                          theme={codeMirrorTheme}
                          className={TEMPLATE_DESIGNER_CM_CLASS}
                          height="100%"
                          onChange={editorOnChange}
                          onBlur={editorOnBlur}
                        />
                      </div>
                    </>
                  )}
                  {rightPanelSlot && !showYaml && (
                    <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                      {rightPanelSlot}
                    </div>
                  )}
                </Paper>
              )}
            </div>
          </div>
        </Grid>
      </Grid>
    </div>
  );
};
