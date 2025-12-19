import type { FC, SyntheticEvent } from "react";
import { alpha, styled, useTheme } from "@material-ui/core/styles";
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from "@material-ui/core";
import ViewListIcon from "@material-ui/icons/ViewList";
import AddIcon from "@material-ui/icons/Add";
import ArrowUpwardIcon from "@material-ui/icons/ArrowUpward";
import ArrowDownwardIcon from "@material-ui/icons/ArrowDownward";
import type {
  ParameterFieldDisplay,
  ParameterSectionDisplay,
} from "../../types/flowNodes";
import { ParameterInputNode } from "./ParameterInputNode";

const resolvePaletteMode = (theme: { palette: { type?: string } }) =>
  (theme.palette as { mode?: "light" | "dark" }).mode ??
  theme.palette.type ??
  "light";

const Card = styled(Box)(({ theme }) => {
  const paletteMode = resolvePaletteMode(theme);
  return {
    position: "relative",
    background: alpha(
      theme.palette.info.main,
      paletteMode === "dark" ? 0.22 : 0.12
    ),
    border: `1px solid ${alpha(theme.palette.info.main, 0.4)}`,
    borderRadius: 12,
    width: 660,
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
      theme.palette.info.main,
      paletteMode === "dark" ? 0.25 : 0.16
    ),
    border: `1px solid ${alpha(theme.palette.info.main, 0.45)}`,
  };
});

const SectionRow = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(0.5),
  padding: theme.spacing(1.25, 1),
}));

const SectionMeta = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(1),
  flexWrap: "wrap",
}));

const FieldsGrid = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  gap: theme.spacing(1),
}));

const EmptyState = styled(Box)(({ theme }) => ({
  border: `2px dashed ${alpha(theme.palette.info.main, 0.4)}`,
  borderRadius: 12,
  padding: theme.spacing(3),
  textAlign: "center",
  color: alpha(theme.palette.text.primary, 0.7),
}));

type ParameterTitlesProps = {
  sections: ParameterSectionDisplay[];
  onSectionUpdate?: (
    sectionId: string,
    updater: (section: ParameterSectionDisplay) => ParameterSectionDisplay
  ) => void;
  onFieldUpdate?: (
    sectionId: string,
    fieldId: string,
    updater: (field: ParameterFieldDisplay) => ParameterFieldDisplay
  ) => void;
  onAddSection?: (afterSectionId?: string) => void;
  onMoveSection?: (sectionId: string, direction: "up" | "down") => void;
  onAddField?: (sectionId: string, afterFieldId?: string) => void;
  onMoveField?: (
    sectionId: string,
    fieldId: string,
    direction: "up" | "down"
  ) => void;
};

export const ParameterTitlesNode: FC<ParameterTitlesProps> = ({
  sections,
  onSectionUpdate,
  onFieldUpdate,
  onAddSection,
  onMoveSection,
  onAddField,
  onMoveField,
}) => {
  const theme = useTheme();
  const paletteMode = resolvePaletteMode(theme);
  const safeSections = sections ?? [];

  const handleSectionTitleChange = (sectionId: string, value: string) => {
    onSectionUpdate?.(sectionId, (section) => ({
      ...section,
      title: value,
      fields:
        section.fields?.map((field) => ({
          ...field,
          sectionTitle: value,
        })) ?? [],
    }));
  };

  const handleSectionDescriptionChange = (sectionId: string, value: string) => {
    onSectionUpdate?.(sectionId, (section) => ({
      ...section,
      description: value,
    }));
  };

  const handleFieldUpdate = (
    sectionId: string,
    fieldId: string,
    updater: (field: ParameterFieldDisplay) => ParameterFieldDisplay
  ) => {
    onFieldUpdate?.(sectionId, fieldId, updater);
  };

  const preventDrag = (event: SyntheticEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  return (
    <Card>
      <Header>
        <Box
          display="flex"
          alignItems="center"
          style={{ gap: theme.spacing(1) }}
        >
          <ViewListIcon fontSize="small" htmlColor={theme.palette.info.dark} />
          <Typography variant="subtitle2" noWrap>
            Parameter Titles
          </Typography>
        </Box>
        <Chip
          size="small"
          label={`${safeSections.length} section${
            safeSections.length === 1 ? "" : "s"
          }`}
          variant="outlined"
          style={{
            borderColor: theme.palette.info.dark,
            color:
              paletteMode === "dark"
                ? theme.palette.info.light
                : theme.palette.info.dark,
          }}
        />
      </Header>

      {safeSections.length === 0 ? (
        <EmptyState>
          <Typography variant="body2">
            No parameter sections were detected. Define template parameters to
            see them listed here.
          </Typography>
        </EmptyState>
      ) : null}

      {safeSections.map((section, index) => {
        const fieldCount = section.fields?.length ?? 0;
        return (
          <Box key={section.id ?? index}>
            <SectionRow>
              <Box
                display="flex"
                justifyContent="flex-end"
                style={{ gap: theme.spacing(0.5) }}
              >
                <Tooltip title="Add section">
                  <IconButton
                    size="small"
                    onPointerDown={preventDrag}
                    onClick={(event) => {
                      event.stopPropagation();
                      onAddSection?.(section.id);
                    }}
                  >
                    <AddIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Move section up">
                  <span>
                    <IconButton
                      size="small"
                      disabled={index === 0}
                      onPointerDown={preventDrag}
                      onClick={(event) => {
                        event.stopPropagation();
                        onMoveSection?.(section.id, "up");
                      }}
                    >
                      <ArrowUpwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
                <Tooltip title="Move section down">
                  <span>
                    <IconButton
                      size="small"
                      disabled={index === safeSections.length - 1}
                      onPointerDown={preventDrag}
                      onClick={(event) => {
                        event.stopPropagation();
                        onMoveSection?.(section.id, "down");
                      }}
                    >
                      <ArrowDownwardIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
              <TextField
                label="Section title"
                size="small"
                variant="outlined"
                value={section.title ?? ""}
                onChange={(event) =>
                  handleSectionTitleChange(section.id, event.target.value)
                }
                fullWidth
              />
              <TextField
                label="Section description"
                size="small"
                variant="outlined"
                value={section.description ?? ""}
                onChange={(event) =>
                  handleSectionDescriptionChange(section.id, event.target.value)
                }
                fullWidth
                multiline
                minRows={2}
              />
              <SectionMeta>
                <Chip
                  size="small"
                  label={`${fieldCount} propert${
                    fieldCount === 1 ? "y" : "ies"
                  }`}
                />
                <Chip
                  size="small"
                  variant="outlined"
                  color="primary"
                  label={
                    section.required?.length
                      ? `${section.required.length} required`
                      : "No required fields"
                  }
                />
              </SectionMeta>
            </SectionRow>

            {section.fields?.length ? (
              <FieldsGrid>
                {section.fields.map((field, fieldIndex) => (
                  <ParameterInputNode
                    key={field.id}
                    field={field}
                    index={fieldIndex}
                    totalCount={section.fields?.length ?? 0}
                    onFieldUpdate={(updater) =>
                      handleFieldUpdate(section.id, field.id, updater)
                    }
                    onAddField={() => onAddField?.(section.id, field.id)}
                    onMoveField={(direction) =>
                      onMoveField?.(section.id, field.id, direction)
                    }
                  />
                ))}
              </FieldsGrid>
            ) : (
              <Box mt={1}>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => onAddField?.(section.id)}
                >
                  Add parameter input
                </Button>
              </Box>
            )}

            {index < safeSections.length - 1 ? <Divider /> : null}
          </Box>
        );
      })}
    </Card>
  );
};
