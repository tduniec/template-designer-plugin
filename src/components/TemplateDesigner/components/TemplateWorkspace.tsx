import { useMemo } from "react";
import Button from "@mui/material/Button";
import Grid from "@mui/material/GridLegacy";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import type {
  ScaffolderTaskOutput,
  TaskStep,
} from "@backstage/plugin-scaffolder-common";
import type { TemplateParametersValue } from "../../../nodes/types";
import App from "../../DesignerFlow/DesignerFlow";

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
}: TemplateWorkspaceProps) => {
  const theme = useTheme();
  const yamlExtensions = useMemo(() => [yaml()], []);
  const codeMirrorTheme = useMemo(
    () => (theme.palette.mode === "dark" ? "dark" : "light"),
    [theme.palette.mode]
  );

  return (
    <Grid container spacing={3} direction="column">
      <Grid item style={{ height: 800 }}>
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
            <Button variant="outlined" size="small" onClick={onToggleYaml}>
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
                  parameters={templateParameters}
                  output={templateOutput}
                  onStepsChange={onStepsChange}
                  onParametersChange={onParametersChange}
                  onOutputChange={onOutputChange}
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
                        theme.palette.mode === "dark"
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
                    onChange={(value) => onYamlChange(value)}
                  />
                </div>
              </Paper>
            )}
          </div>
        </div>
      </Grid>
    </Grid>
  );
};
