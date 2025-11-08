import { useCallback, useMemo } from "react";
import { alpha, styled, useTheme } from "@mui/material/styles";
import {
  Box,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import TuneIcon from "@mui/icons-material/Tune";
import AddIcon from "@mui/icons-material/Add";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import type { ParameterFieldDisplay } from "./types";

const Card = styled(Box)(({ theme }) => ({
  position: "relative",
  background: alpha(
    theme.palette.success.main,
    theme.palette.mode === "dark" ? 0.2 : 0.12
  ),
  border: `1px solid ${alpha(theme.palette.success.main, 0.45)}`,
  borderRadius: 12,
  width: 520,
  padding: theme.spacing(1.5),
  boxShadow: theme.shadows[2],
  color: theme.palette.text.primary,
}));

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1),
  marginBottom: theme.spacing(1),
  borderRadius: 8,
  backgroundColor: alpha(
    theme.palette.success.main,
    theme.palette.mode === "dark" ? 0.25 : 0.16
  ),
  border: `1px solid ${alpha(theme.palette.success.main, 0.45)}`,
}));

type ParameterInputProps = {
  field: ParameterFieldDisplay;
  index: number;
  totalCount: number;
  onFieldUpdate?: (
    updater: (field: ParameterFieldDisplay) => ParameterFieldDisplay
  ) => void;
  onAddField?: () => void;
  onMoveField?: (direction: "up" | "down") => void;
};

const shouldParseDefault = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed.length) {
    return false;
  }
  if (trimmed === "true" || trimmed === "false" || trimmed === "null") {
    return true;
  }
  if (!Number.isNaN(Number(trimmed))) {
    return true;
  }
  return trimmed.startsWith("{") || trimmed.startsWith("[");
};

export const ParameterInputNode: React.FC<ParameterInputProps> = ({
  field,
  index,
  totalCount,
  onFieldUpdate,
  onAddField,
  onMoveField,
}) => {
  const theme = useTheme();
  const { fieldName, schema, required, sectionTitle } = field;
  const schemaRecord = (schema ?? {}) as Record<string, unknown>;
  const defaultValue = schemaRecord.default;
  const schemaTitle =
    typeof schemaRecord.title === "string" ? (schemaRecord.title as string) : "";
  const schemaDescription =
    typeof schemaRecord.description === "string"
      ? (schemaRecord.description as string)
      : "";

  const schemaSummary = useMemo(() => {
    if (!schema) {
      return "any";
    }
    const typeValue = schemaRecord.type;
    if (Array.isArray(typeValue)) {
      return typeValue.map(String).join(" | ");
    }
    if (typeof typeValue === "string") {
      return typeValue;
    }
    return "any";
  }, [schema, schemaRecord]);

  const defaultString = useMemo(() => {
    if (defaultValue === undefined || defaultValue === null) {
      return "";
    }
    if (typeof defaultValue === "string") {
      return defaultValue;
    }
    try {
      return JSON.stringify(defaultValue);
    } catch {
      return String(defaultValue);
    }
  }, [defaultValue]);

  const updateField = useCallback(
    (updater: (current: ParameterFieldDisplay) => ParameterFieldDisplay) => {
      onFieldUpdate?.(updater);
    },
    [onFieldUpdate]
  );

  const updateSchema = useCallback(
    (patch: Record<string, unknown>) => {
      updateField((current) => ({
        ...current,
        schema: {
          ...(current.schema ?? {}),
          ...patch,
        },
      }));
    },
    [updateField]
  );

  const handleDefaultChange = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed.length) {
      updateSchema({ default: undefined });
      return;
    }

    if (shouldParseDefault(trimmed)) {
      try {
        updateSchema({ default: JSON.parse(trimmed) });
        return;
      } catch {
        // swallow parse errors and treat as plain text below
      }
    }

    updateSchema({ default: value });
  };

  const preventDrag = (event: React.SyntheticEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  return (
    <Card>
      <Header>
        <Box display="flex" flexDirection="column" width="100%">
          <Box
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            style={{ gap: theme.spacing(1) }}
          >
            <Box
              display="flex"
              alignItems="center"
              style={{ gap: theme.spacing(1) }}
            >
              <TuneIcon
                fontSize="small"
                htmlColor={theme.palette.success.dark}
              />
              <Typography variant="subtitle2">
                {schemaTitle || fieldName || "Field"}
              </Typography>
            </Box>
            <Typography variant="caption" color="textSecondary">
              {schemaSummary}
            </Typography>
          </Box>
          <Box
            display="flex"
            justifyContent="flex-end"
            style={{
              gap: 4,
              marginTop: theme.spacing(0.5),
            }}
          >
            <Tooltip title="Add parameter input">
              <IconButton
                size="small"
                onPointerDown={preventDrag}
                onClick={(event) => {
                  event.stopPropagation();
                  onAddField?.();
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Move up">
              <span>
                <IconButton
                  size="small"
                  disabled={index === 0}
                  onPointerDown={preventDrag}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveField?.("up");
                  }}
                >
                  <ArrowUpwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <Tooltip title="Move down">
              <span>
                <IconButton
                  size="small"
                  disabled={index === totalCount - 1}
                  onPointerDown={preventDrag}
                  onClick={(event) => {
                    event.stopPropagation();
                    onMoveField?.("down");
                  }}
                >
                  <ArrowDownwardIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
          {sectionTitle ? (
            <Typography variant="caption" color="textSecondary">
              {sectionTitle}
            </Typography>
          ) : null}
        </Box>
      </Header>

      <Box
        display="flex"
        flexDirection="column"
        style={{ gap: theme.spacing(1.5) }}
      >
        <TextField
          label="Field name"
          size="small"
          variant="outlined"
          value={fieldName ?? ""}
          onChange={(event) =>
            updateField((current) => ({
              ...current,
              fieldName: event.target.value,
            }))
          }
        />
        <TextField
          label="Label"
          size="small"
          variant="outlined"
          value={schemaTitle}
          onChange={(event) => updateSchema({ title: event.target.value })}
        />
        <TextField
          label="Type"
          size="small"
          variant="outlined"
          value={schemaSummary === "any" ? "" : schemaSummary}
          onChange={(event) => {
            const value = event.target.value.trim();
            updateSchema({ type: value.length ? value : undefined });
          }}
        />
        <TextField
          label="Description"
          size="small"
          variant="outlined"
          multiline
          minRows={2}
          value={schemaDescription}
          onChange={(event) =>
            updateSchema({ description: event.target.value })
          }
        />
        <TextField
          label="Default value"
          size="small"
          variant="outlined"
          value={defaultString}
          onChange={(event) => handleDefaultChange(event.target.value)}
        />
        <FormControlLabel
          control={
            <Switch
              color="primary"
              checked={required}
              onChange={(event) =>
                updateField((current) => ({
                  ...current,
                  required: event.target.checked,
                }))
              }
            />
          }
          label="Required"
        />
      </Box>
    </Card>
  );
};
