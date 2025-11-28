import { Handle, NodeToolbar, Position } from "@xyflow/react";
import { memo } from "react";
import { alpha, styled, useTheme } from "@material-ui/core/styles";
import { Box, Button, Chip, Typography } from "@material-ui/core";
import SettingsIcon from "@material-ui/icons/Settings";
import AddIcon from "@material-ui/icons/Add";
import type { ParametersNodeData } from "./types";
import { ParameterTitlesNode } from "./ParameterTitlesNode";
import { createStopNodeInteraction } from "./common/nodeInteraction";
import { useParameterSectionsController } from "./parameters/useParameterSections";

const resolvePaletteMode = (theme: { palette: { type?: string } }) =>
  (theme.palette as { mode?: "light" | "dark" }).mode ??
  theme.palette.type ??
  "light";

const Card = styled(Box)(({ theme }) => {
  const paletteMode = resolvePaletteMode(theme);
  return {
    position: "relative",
    background: alpha(
      theme.palette.warning.main,
      paletteMode === "dark" ? 0.18 : 0.12
    ),
    border: `1px solid ${alpha(theme.palette.warning.main, 0.35)}`,
    borderRadius: 12,
    width: 760,
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
        paletteMode === "dark" ? 0.28 : 0.18
      )}, transparent 65%)`,
      pointerEvents: "none",
      zIndex: 0,
    },
    "& > *": {
      position: "relative",
      zIndex: 1,
    },
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
      theme.palette.warning.main,
      paletteMode === "dark" ? 0.24 : 0.14
    ),
    border: `1px solid ${alpha(theme.palette.warning.main, 0.4)}`,
  };
});

const ParametersNodeComponent: React.FC<{ data: ParametersNodeData }> = ({
  data,
}) => {
  const theme = useTheme();
  const paletteMode = resolvePaletteMode(theme);
  const {
    sections,
    handleSectionUpdate,
    handleFieldUpdate,
    handleAddSection,
    handleMoveSection,
    handleAddField,
    handleMoveField,
  } = useParameterSectionsController(data);

  const stopAll = createStopNodeInteraction();

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
            Parameters
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label="parameters"
          style={{
            borderColor: theme.palette.warning.dark,
            color:
              paletteMode === "dark"
                ? theme.palette.warning.light
                : theme.palette.warning.dark,
            textTransform: "uppercase",
          }}
        />
      </Header>

      <Box mt={2}>
        <ParameterTitlesNode
          sections={sections}
          onSectionUpdate={handleSectionUpdate}
          onFieldUpdate={handleFieldUpdate}
          onAddSection={handleAddSection}
          onMoveSection={handleMoveSection}
          onAddField={handleAddField}
          onMoveField={handleMoveField}
        />
      </Box>

      <NodeToolbar position={Position.Bottom}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() =>
            data.onAddNode?.({
              afterRfId: data.rfId,
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

export const ParametersNode = memo(ParametersNodeComponent);
