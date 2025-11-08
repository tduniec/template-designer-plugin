import type { KeyboardEvent, SyntheticEvent } from "react";
import { Handle, NodeToolbar, Position } from "@xyflow/react";
import { alpha, styled, useTheme } from "@mui/material/styles";
import { Box, Button, Chip, Typography } from "@material-ui/core";
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import type { ParametersNodeData } from "./types";

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

const Placeholder = styled(Box)(({ theme }) => ({
  minHeight: 200,
  border: `2px dashed ${alpha(theme.palette.warning.main, 0.6)}`,
  borderRadius: 16,
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  padding: theme.spacing(3),
  gap: theme.spacing(1.25),
  backgroundColor: alpha(
    theme.palette.warning.light,
    theme.palette.mode === "dark" ? 0.08 : 0.04
  ),
}));

const PlaceholderHint = styled(Typography)(({ theme }) => ({
  fontSize: "0.9rem",
  color: alpha(theme.palette.text.primary, 0.8),
}));

export const ParametersNode: React.FC<{ data: ParametersNodeData }> = ({
  data,
}) => {
  const theme = useTheme();
  const { rfId } = data;

  const stopAll = {
    onPointerDown: (event: SyntheticEvent) => event.stopPropagation(),
    onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
    className: "nodrag nowheel",
    inputProps: { "data-nodrag": true },
  } as const;

  return (
    <Card>
      <Header>
        <Box
          display="flex"
          alignItems="center"
          style={{ gap: theme.spacing(1) }}
        >
          <SettingsIcon
            fontSize="small"
            htmlColor={theme.palette.warning.dark}
          />
          <Typography variant="subtitle2" noWrap>
            Parameters Placeholder
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label="parameters"
          style={{
            borderColor: theme.palette.warning.dark,
            color:
              theme.palette.mode === "dark"
                ? theme.palette.warning.light
                : theme.palette.warning.dark,
            textTransform: "uppercase",
          }}
        />
      </Header>

      <Placeholder>
        <Typography variant="h6" gutterBottom>
          Ready for parameter structure
        </Typography>
        <PlaceholderHint>
          This node pins the start of your template inputs. Attach the title and
          field nodes below to describe each parameter group and property.
        </PlaceholderHint>
        <PlaceholderHint>
          Customize styling later — for now it simply reserves space for the
          advanced parameter flow.
        </PlaceholderHint>
      </Placeholder>

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

      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
