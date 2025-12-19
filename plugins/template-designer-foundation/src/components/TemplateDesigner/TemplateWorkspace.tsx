import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import {
  Button,
  Grid,
  Paper,
  Typography,
  CircularProgress,
} from "@material-ui/core";
import { useTheme } from "@material-ui/core/styles";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { createCodeMirrorTheme } from "./codemirrorTheme";
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
  flowTopSlot?: ReactNode;
  rightPanelSlot?: ReactNode;
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
  flowTopSlot,
  rightPanelSlot,
}: TemplateWorkspaceProps) => {
  const theme = useTheme();
  const paletteMode =
    (theme.palette as { mode?: "light" | "dark" }).mode ??
    theme.palette.type ??
    "light";
  const yamlDraftRef = useRef(templateYaml);
  const templateYamlRef = useRef(templateYaml);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
      }, 300);
    },
    [onYamlChange]
  );

  const handleYamlBlur = useCallback(() => {
    flushYamlDraft();
  }, [flushYamlDraft]);

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
      flushYamlDraft();
    },
    [flushYamlDraft]
  );

  return (
    <div
      style={{
        position: "relative",
        height: "calc(100vh - 160px)",
        minHeight: "70vh",
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
                  onClick={onSave}
                  disabled={isSaving}
                >
                  {saveButtonLabel}
                </Button>
                <Button
                  color="primary"
                  variant="outlined"
                  size="small"
                  onClick={onOpenTemplatePicker}
                >
                  Load different file
                </Button>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {isSyncing && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "2px 6px",
                      borderRadius: 6,
                      background:
                        paletteMode === "dark"
                          ? "rgba(33,33,33,0.8)"
                          : "rgba(255,255,255,0.9)",
                      border: `1px solid ${theme.palette.divider}`,
                    }}
                  >
                    <CircularProgress size={14} thickness={5} color="primary" />
                    <Typography variant="caption" color="textSecondary">
                      Syncing...
                    </Typography>
                  </div>
                )}
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
              }}
            >
              <div style={{ flex: showYaml ? 1.6 : 1, minWidth: 0 }}>
                <div style={{ height: "100%" }}>
                  {flowTopSlot}
                  <DesignerFlow
                    steps={templateSteps}
                    parameters={templateParameters}
                    output={templateOutput}
                    onStepsChange={onStepsChange}
                    onParametersChange={onParametersChange}
                    onOutputChange={onOutputChange}
                    actionNodeComponent={actionNodeComponent}
                    parametersNodeComponent={parametersNodeComponent}
                    outputNodeComponent={outputNodeComponent}
                  />
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
                          value={templateYaml}
                          extensions={yamlExtensions}
                          theme={codeMirrorTheme}
                          height="100%"
                          onChange={handleYamlChange}
                          onBlur={handleYamlBlur}
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
