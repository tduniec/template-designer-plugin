import { useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import { alpha, styled, useTheme } from "@mui/material/styles";
import { Box, Chip, Divider, Typography } from "@material-ui/core";
import TuneIcon from "@mui/icons-material/Tune";
import type { ParameterInputNodeData } from "./types";

const Card = styled(Box)(({ theme }) => ({
  position: "relative",
  background: alpha(
    theme.palette.success.main,
    theme.palette.mode === "dark" ? 0.2 : 0.12
  ),
  border: `1px solid ${alpha(theme.palette.success.main, 0.45)}`,
  borderRadius: 12,
  width: 500,
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

const SchemaPreview = styled("pre")(({ theme }) => ({
  margin: 0,
  backgroundColor: alpha(theme.palette.common.black, 0.08),
  borderRadius: 8,
  padding: theme.spacing(1),
  fontSize: "0.8rem",
  maxHeight: 180,
  overflow: "auto",
}));

export const ParameterInputNode: React.FC<{ data: ParameterInputNodeData }> = ({
  data,
}) => {
  const theme = useTheme();
  const { fieldName, schema, required, sectionTitle } = data;
  const schemaRecord = (schema ?? {}) as Record<string, unknown>;
  const enumValues = Array.isArray(schemaRecord["enum"])
    ? (schemaRecord["enum"] as unknown[])
    : undefined;
  const defaultValue = schemaRecord["default"];

  const schemaSummary = useMemo(() => {
    if (!schema) {
      return "Not defined";
    }
    const record = schema as Record<string, unknown>;
    const typeValue = record["type"];
    if (Array.isArray(typeValue)) {
      return typeValue.map((value) => String(value)).join(" | ");
    }
    if (typeof typeValue === "string") {
      return typeValue;
    }
    return "any";
  }, [schema]);

  const schemaPreview = useMemo(() => {
    if (!schema) {
      return "{ }";
    }
    try {
      return JSON.stringify(schema, null, 2);
    } catch {
      return "{ }";
    }
  }, [schema]);

  return (
    <Card>
      <Header>
        <Box display="flex" flexDirection="column">
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
              {schema?.title ?? fieldName}
            </Typography>
          </Box>
          {sectionTitle ? (
            <Typography variant="caption" color="textSecondary">
              {sectionTitle}
            </Typography>
          ) : null}
        </Box>
        <Chip
          size="small"
          label={required ? "required" : "optional"}
          color={required ? "secondary" : "default"}
          variant={required ? "default" : "outlined"}
        />
      </Header>

      {schema?.description ? (
        <Typography variant="body2" color="textSecondary" gutterBottom>
          {schema.description}
        </Typography>
      ) : null}

      <Box
        display="flex"
        flexWrap="wrap"
        style={{
          gap: theme.spacing(1),
          marginBottom: theme.spacing(1),
        }}
      >
        <Chip size="small" label={`type: ${schemaSummary}`} />
        {enumValues
          ? (
            <Chip
              size="small"
              label={`enum: ${enumValues.length} values`}
            />
          )
          : null}
        {defaultValue !== undefined ? (
          <Chip size="small" label={`default: ${String(defaultValue)}`} />
        ) : null}
      </Box>

      <Divider />

      <Box mt={1}>
        <Typography variant="caption" color="textSecondary">
          schema
        </Typography>
        <SchemaPreview>{schemaPreview}</SchemaPreview>
      </Box>

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
