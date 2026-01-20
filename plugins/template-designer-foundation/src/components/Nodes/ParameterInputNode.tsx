import type { FC, SyntheticEvent } from "react";
import { useCallback, useMemo } from "react";
import { alpha, styled, useTheme } from "@material-ui/core/styles";
import {
  Box,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  IconButton,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import TuneIcon from "@material-ui/icons/Tune";
import AddIcon from "@material-ui/icons/Add";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import type { ParameterFieldDisplay } from "../../types/flowNodes";
import type {
  ParameterInputExtrasArgs,
  ParameterNodeExtensions,
} from "../../parameters/extensions/types";

const resolvePaletteMode = (theme: { palette: { type?: string } }) =>
  (theme.palette as { mode?: "light" | "dark" }).mode ??
  theme.palette.type ??
  "light";

const Card = styled(Box)(({ theme }) => {
  const paletteMode = resolvePaletteMode(theme);
  return {
    position: "relative",
    background: alpha(
      theme.palette.success.main,
      paletteMode === "dark" ? 0.2 : 0.12
    ),
    border: `1px solid ${alpha(theme.palette.success.main, 0.45)}`,
    borderRadius: 12,
    width: 580,
    padding: theme.spacing(1.5),
    boxShadow: theme.shadows[2],
    color: theme.palette.text.primary,
  };
});

const Header = styled(Box)(({ theme }) => {
  const paletteMode = resolvePaletteMode(theme);
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing(1),
    marginBottom: theme.spacing(1),
    borderRadius: 8,
    backgroundColor: alpha(
      theme.palette.success.main,
      paletteMode === "dark" ? 0.25 : 0.16
    ),
    border: `1px solid ${alpha(theme.palette.success.main, 0.45)}`,
  };
});

type ParameterInputProps = {
  field: ParameterFieldDisplay;
  index: number;
  totalCount: number;
  extensions?: ParameterNodeExtensions;
  formState?: ParameterInputExtrasArgs["formState"];
  nodeId?: string;
  isSelected?: boolean;
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

export const ParameterInputNode: FC<ParameterInputProps> = ({
  field,
  index,
  totalCount,
  extensions,
  formState,
  nodeId,
  isSelected,
  onFieldUpdate,
  onAddField,
  onMoveField,
}) => {
  const theme = useTheme();
  const { fieldName, schema, required, sectionTitle } = field;
  const schemaRecord = useMemo(
    () => (schema ?? {}) as Record<string, unknown>,
    [schema]
  );
  const defaultValue = schemaRecord.default;
  const schemaTitle =
    typeof schemaRecord.title === "string"
      ? (schemaRecord.title as string)
      : "";
  const schemaDescription =
    typeof schemaRecord.description === "string"
      ? (schemaRecord.description as string)
      : "";

  const schemaSummary = useMemo(() => {
    const typeValue = schemaRecord.type;
    if (Array.isArray(typeValue) && typeValue.length) {
      return String(typeValue[0]);
    }
    if (typeof typeValue === "string" && typeValue.length) {
      return typeValue;
    }
    return "string";
  }, [schemaRecord]);

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

  const preventDrag = (event: SyntheticEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  const handleTypeChange = (nextType: string) => {
    updateField((current) => {
      const prevSchema = (current.schema ?? {}) as Record<string, unknown>;
      const next: Record<string, unknown> = { ...prevSchema, type: nextType };
      if (nextType !== "object") {
        delete next.properties;
      } else if (!next.properties) {
        next.properties = {};
      }
      if (
        nextType !== "string" &&
        nextType !== "number" &&
        nextType !== "boolean"
      ) {
        delete next.enum;
        delete next.default;
      }
      return {
        ...current,
        schema: next,
      };
    });
  };

  const renderInputExtras = extensions?.renderInputExtras;

  const extrasArgs = useMemo<ParameterInputExtrasArgs | undefined>(() => {
    if (!renderInputExtras) {
      return undefined;
    }
    return {
      fieldId: field.id,
      fieldPath: [field.sectionId, field.fieldName].filter(
        (part): part is string => Boolean(part)
      ),
      fieldModel: field,
      schema,
      formState,
      onFieldChange: onFieldUpdate ? updateField : undefined,
      nodeId,
      isSelected,
    };
  }, [
    field,
    formState,
    isSelected,
    nodeId,
    renderInputExtras,
    schema,
    onFieldUpdate,
    updateField,
  ]);

  const extrasContent = useMemo(
    () =>
      renderInputExtras && extrasArgs
        ? renderInputExtras(extrasArgs)
        : undefined,
    [extrasArgs, renderInputExtras]
  );

  const handleExtrasPointerDown = useCallback((event: SyntheticEvent) => {
    // Keep ReactFlow node drag/selection stable when interacting with extensions.
    event.stopPropagation();
  }, []);

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
        mt={1}
        display="flex"
        flexDirection="column"
        style={{ gap: theme.spacing(1) }}
      >
        <TextField
          label="Field name"
          value={fieldName}
          size="small"
          variant="outlined"
          onChange={(event) =>
            updateField((current) => ({
              ...current,
              fieldName: event.target.value,
            }))
          }
          fullWidth
        />
        <FormControl size="small" variant="outlined" fullWidth>
          <InputLabel id={`param-type-${field.id}`}>Type</InputLabel>
          <Select
            labelId={`param-type-${field.id}`}
            value={schemaSummary}
            label="Type"
            className="nodrag nowheel"
            onChange={(event) => handleTypeChange(event.target.value as string)}
          >
            <MenuItem value="string">string</MenuItem>
            <MenuItem value="number">number</MenuItem>
            <MenuItem value="boolean">boolean</MenuItem>
            <MenuItem value="object">object</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="Title"
          value={schemaTitle}
          size="small"
          variant="outlined"
          onChange={(event) =>
            updateSchema({ title: event.target.value || undefined })
          }
          fullWidth
        />
        <TextField
          label="Description"
          value={schemaDescription}
          size="small"
          variant="outlined"
          onChange={(event) =>
            updateSchema({
              description: event.target.value || undefined,
            })
          }
          fullWidth
          multiline
          minRows={2}
        />
        <TextField
          label="Default"
          value={defaultString}
          size="small"
          variant="outlined"
          onChange={(event) => handleDefaultChange(event.target.value)}
          fullWidth
          multiline
          minRows={2}
          placeholder="Supports strings, numbers, booleans, objects, and arrays"
        />
        <Box
          display="flex"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
        >
          <FormControlLabel
            control={
              <Switch
                size="small"
                color="primary"
                checked={required ?? false}
                onChange={(_, checked) =>
                  updateField((current) => ({
                    ...current,
                    required: checked,
                  }))
                }
              />
            }
            label={
              <Typography variant="body2" color="textSecondary">
                Required
              </Typography>
            }
          />
          <Typography variant="caption" color="textSecondary">
            Double-click text fields to edit in a modal.
          </Typography>
        </Box>
        {extrasContent ? (
          <Box mt={1.5}>
            <Divider />
            <Box mt={1} onPointerDown={handleExtrasPointerDown}>
              {extrasContent}
            </Box>
          </Box>
        ) : null}
      </Box>
    </Card>
  );
};
