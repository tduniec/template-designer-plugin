import type { FC } from "react";
import { Handle, NodeToolbar, Position, useReactFlow } from "@xyflow/react";
import { memo, useLayoutEffect, useRef } from "react";
import { alpha, styled, useTheme } from "@material-ui/core/styles";
import { Box, Button, Chip, Typography } from "@material-ui/core";
import SettingsIcon from "@material-ui/icons/Settings";
import AddIcon from "@material-ui/icons/Add";
import type { ParametersNodeData } from "../../types/flowNodes";
import { createStopNodeInteraction } from "./common/nodeInteraction";
import { useParameterSectionsController } from "../../state/useParameterSections";
import { ParameterTitlesNode } from "./ParameterTitlesNode";

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

const ParametersNodeComponent: FC<{ data: ParametersNodeData }> = ({
  data,
}) => {
  if (process.env.NODE_ENV === "development") {
    // Quick dev-only visibility into unnecessary renders per node.
    // eslint-disable-next-line no-console
    console.debug("[DesignerFlow] render ParametersNode", data.rfId);
  }
  const theme = useTheme();
  const paletteMode = resolvePaletteMode(theme);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const heightRef = useRef<number | null>(null);
  const { setNodes } = useReactFlow();
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

  useLayoutEffect(() => {
    const element = cardRef.current;
    if (!element) {
      return undefined;
    }
    let raf: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      const nextHeight = entry.contentRect.height;
      const previousHeight = heightRef.current ?? nextHeight;
      if (Math.abs(previousHeight - nextHeight) < 1) {
        return;
      }
      heightRef.current = nextHeight;
      if (raf) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(() => {
        setNodes((nodes) =>
          nodes.map((node) =>
            node.id === data.rfId
              ? {
                  ...node,
                  data: { ...(node.data as any), measuredHeight: nextHeight },
                }
              : node
          )
        );
      });
    });
    observer.observe(element);
    return () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      observer.disconnect();
    };
  }, [data.rfId, setNodes]);

  return (
    <div ref={cardRef}>
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
    </div>
  );
};

export const ParametersNode = memo(ParametersNodeComponent);
