import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, KeyboardEvent, SyntheticEvent } from "react";
import { Handle, NodeToolbar, Position } from "@xyflow/react";
import { alpha, styled, useTheme } from "@mui/material/styles";
import {
  Box,
  Button,
  Chip,
  Divider,
  TextField,
  Typography,
} from "@material-ui/core";
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import type { ParametersNodeData, TemplateParametersValue } from "./types";

const Card = styled(Box)(({ theme }) => ({
  position: "relative",
  background: alpha(
    theme.palette.warning.main,
    theme.palette.mode === "dark" ? 0.18 : 0.12
  ),
  border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
  borderRadius: 12,
  width: 700,
  padding: theme.spacing(1.5),
  boxShadow: theme.shadows[2],
  color: theme.palette.text.primary,
  overflow: "hidden",
  "&::before": {
    content: '""',
    position: "absolute",
    inset: 0,
    background: `linear-gradient(135deg, ${alpha(
      theme.palette.warning.light,
      theme.palette.mode === "dark" ? 0.28 : 0.18
    )}, transparent 65%)`,
    pointerEvents: "none",
    zIndex: 0,
  },
  "& > *": {
    position: "relative",
    zIndex: 1,
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: theme.spacing(1),
  marginBottom: theme.spacing(1),
  borderRadius: 8,
  backgroundColor: alpha(
    theme.palette.warning.main,
    theme.palette.mode === "dark" ? 0.24 : 0.14
  ),
  border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
}));

const stringifyParameters = (value: TemplateParametersValue) => {
  if (value === undefined || value === null) {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const parseParameters = (raw: string): TemplateParametersValue => {
  if (!raw.trim()) {
    return undefined;
  }
  return JSON.parse(raw) as TemplateParametersValue;
};

export const ParametersNode: React.FC<{ data: ParametersNodeData }> = ({
  data,
}) => {
  const theme = useTheme();
  const { rfId, parameters } = data;
  const [text, setText] = useState(() => stringifyParameters(parameters));
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setText(stringifyParameters(parameters));
  }, [parameters]);

  const stopAll = {
    onPointerDown: (event: SyntheticEvent) => event.stopPropagation(),
    onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
    className: "nodrag nowheel",
    inputProps: { "data-nodrag": true },
  } as const;

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setText(event.target.value);
    setError(undefined);
  };

  const handleApply = () => {
    try {
      const nextValue = parseParameters(text);
      data.onUpdateParameters?.(rfId, () => nextValue);
      setError(undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid JSON input";
      setError(message);
    }
  };

  return (
    <Card>
      <Header>
        <Box display="flex" alignItems="center">
          <SettingsIcon
            fontSize="small"
            htmlColor={theme.palette.warning.dark}
          />
          <Typography variant="subtitle2" noWrap>
            Template Parameters
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label="Inputs"
          style={{
            borderColor: theme.palette.warning.dark,
            color:
              theme.palette.mode === "dark"
                ? theme.palette.warning.light
                : theme.palette.warning.dark,
          }}
        />
      </Header>


       <div
      style={{
        width: '650px',
        height: '500px',
        border: '2px solid black', // outline the rectangle
      }}
    />

      <Box mt={1.5} display="flex">
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<AddIcon fontSize="small" />}
          onClick={handleApply}
          className="nodrag nowheel"
          onPointerDown={stopAll.onPointerDown}
          onKeyDown={stopAll.onKeyDown}
        >
          Apply
        </Button>
      </Box>

      <NodeToolbar position={Position.Bottom}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() =>
            data.onAddNode?.({
              afterRfId: rfId,
              type: "actionNode",
            })
          }
          className="nodrag nowheel"
          onPointerDown={stopAll.onPointerDown}
          onKeyDown={stopAll.onKeyDown}
        >
          Add First Action
        </Button>
      </NodeToolbar>

      <Divider style={{ margin: "12px 0", opacity: 0.4 }} />

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
