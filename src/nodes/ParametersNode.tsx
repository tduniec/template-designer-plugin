import { useCallback, type KeyboardEvent, type SyntheticEvent } from "react";
import { Handle, NodeToolbar, Position } from "@xyflow/react";
import { alpha, styled, useTheme } from "@mui/material/styles";
import { Box, Button, Chip, Typography } from "@material-ui/core";
import SettingsIcon from "@mui/icons-material/Settings";
import AddIcon from "@mui/icons-material/Add";
import type {
  ParameterFieldDisplay,
  ParameterSectionDisplay,
  ParametersNodeData,
} from "./types";
import { ParameterTitlesNode } from "./ParameterTitlesNode";

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
  const { rfId, sections = [] } = data;

  const createSection = useCallback((): ParameterSectionDisplay => {
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    return {
      id: `section-${unique}`,
      title: "New Section",
      description: "",
      fields: [],
      properties: {},
      required: [],
    };
  }, []);

  const createField = useCallback(
    (section: ParameterSectionDisplay): ParameterFieldDisplay => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const nextIndex = (section.fields?.length ?? 0) + 1;
      const fallbackName = `field_${nextIndex}`;
      return {
        id: `${section.id}-field-${unique}`,
        fieldName: fallbackName,
        sectionId: section.id,
        sectionTitle: section.title,
        required: false,
        schema: {
          title: `Field ${nextIndex}`,
          type: "string",
        },
      };
    },
    []
  );

  const applySectionsUpdate = useCallback(
    (
      updater: (
        prevSections: ParameterSectionDisplay[]
      ) => ParameterSectionDisplay[]
    ) => {
      if (!data.onUpdateSections) {
        return;
      }
      data.onUpdateSections(rfId, (prev) => updater(prev ?? []));
    },
    [data, rfId]
  );

  const handleSectionUpdate = useCallback(
    (
      sectionId: string,
      updater: (section: ParameterSectionDisplay) => ParameterSectionDisplay
    ) => {
      applySectionsUpdate((prev) =>
        (prev ?? []).map((section) =>
          section.id === sectionId ? updater(section) : section
        )
      );
    },
    [applySectionsUpdate]
  );

  const handleFieldUpdate = useCallback(
    (
      sectionId: string,
      fieldId: string,
      updater: (field: ParameterFieldDisplay) => ParameterFieldDisplay
    ) => {
      handleSectionUpdate(sectionId, (section) => ({
        ...section,
        fields: section.fields?.map((field) =>
          field.id === fieldId ? updater(field) : field
        ) ?? [],
      }));
    },
    [handleSectionUpdate]
  );

  const handleAddSection = useCallback(
    (afterSectionId?: string) => {
      applySectionsUpdate((prev) => {
        const list = [...(prev ?? [])];
        const insertIndex = afterSectionId
          ? Math.max(
              list.findIndex((section) => section.id === afterSectionId) + 1,
              0
            )
          : list.length;
        const nextSection = createSection();
        list.splice(insertIndex, 0, nextSection);
        return list;
      });
    },
    [applySectionsUpdate, createSection]
  );

  const handleMoveSection = useCallback(
    (sectionId: string, direction: "up" | "down") => {
      applySectionsUpdate((prev) => {
        const list = [...(prev ?? [])];
        const currentIndex = list.findIndex((section) => section.id === sectionId);
        if (currentIndex < 0) {
          return list;
        }
        const targetIndex =
          direction === "up" ? currentIndex - 1 : currentIndex + 1;
        if (targetIndex < 0 || targetIndex >= list.length) {
          return list;
        }
        const [item] = list.splice(currentIndex, 1);
        list.splice(targetIndex, 0, item);
        return list;
      });
    },
    [applySectionsUpdate]
  );

  const handleAddField = useCallback(
    (sectionId: string, afterFieldId?: string) => {
      applySectionsUpdate((prev) =>
        (prev ?? []).map((section) => {
          if (section.id !== sectionId) {
            return section;
          }
          const fields = [...(section.fields ?? [])];
          const insertIndex =
            afterFieldId && fields.length
              ? Math.max(
                  fields.findIndex((field) => field.id === afterFieldId) + 1,
                  0
                )
              : fields.length;
          const newField = createField(section);
          fields.splice(insertIndex, 0, newField);
          return {
            ...section,
            fields,
          };
        })
      );
    },
    [applySectionsUpdate, createField]
  );

  const handleMoveField = useCallback(
    (sectionId: string, fieldId: string, direction: "up" | "down") => {
      applySectionsUpdate((prev) =>
        (prev ?? []).map((section) => {
          if (section.id !== sectionId) {
            return section;
          }
          const fields = [...(section.fields ?? [])];
          const currentIndex = fields.findIndex((field) => field.id === fieldId);
          if (currentIndex < 0) {
            return section;
          }
          const targetIndex =
            direction === "up" ? currentIndex - 1 : currentIndex + 1;
          if (targetIndex < 0 || targetIndex >= fields.length) {
            return section;
          }
          const [item] = fields.splice(currentIndex, 1);
          fields.splice(targetIndex, 0, item);
          return {
            ...section,
            fields,
          };
        })
      );
    },
    [applySectionsUpdate]
  );

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
          This node pins the start of your template inputs. The cards below show
          every parameter section and the individual fields that belong to it.
        </PlaceholderHint>
        <PlaceholderHint>
          Customize styling later — for now it simply reserves space for the
          advanced parameter flow.
        </PlaceholderHint>
      </Placeholder>

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
