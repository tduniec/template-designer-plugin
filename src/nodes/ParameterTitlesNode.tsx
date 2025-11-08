import { alpha, styled, useTheme } from "@mui/material/styles";
import {
  Box,
  Chip,
  Divider,
  TextField,
  Typography,
} from "@material-ui/core";
import ViewListIcon from "@mui/icons-material/ViewList";
import type {
  ParameterFieldDisplay,
  ParameterSectionDisplay,
} from "./types";
import { ParameterInputNode } from "./ParameterInputNode";

const Card = styled(Box)(({ theme }) => ({
  position: "relative",
  background: alpha(
    theme.palette.info.main,
    theme.palette.mode === "dark" ? 0.22 : 0.12
  ),
  border: `1px solid ${alpha(theme.palette.info.main, 0.4)}`,
  borderRadius: 12,
  width: 600,
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
    theme.palette.info.main,
    theme.palette.mode === "dark" ? 0.25 : 0.16
  ),
  border: `1px solid ${alpha(theme.palette.info.main, 0.45)}`,
}));

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
};

export const ParameterTitlesNode: React.FC<ParameterTitlesProps> = ({
  sections,
  onSectionUpdate,
  onFieldUpdate,
}) => {
  const theme = useTheme();
  const safeSections = sections ?? [];

  const handleSectionTitleChange = (
    sectionId: string,
    value: string
  ) => {
    onSectionUpdate?.(sectionId, (section) => ({
      ...section,
      title: value,
      fields: section.fields?.map((field) => ({
        ...field,
        sectionTitle: value,
      })) ?? [],
    }));
  };

  const handleSectionDescriptionChange = (
    sectionId: string,
    value: string
  ) => {
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

  return (
    <Card>
      <Header>
        <Box
          display="flex"
          alignItems="center"
          style={{ gap: theme.spacing(1) }}
        >
          <ViewListIcon
            fontSize="small"
            htmlColor={theme.palette.info.dark}
          />
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
              theme.palette.mode === "dark"
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
                  label={`${fieldCount} propert${fieldCount === 1 ? "y" : "ies"}`}
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
                {section.fields.map((field) => (
                  <ParameterInputNode
                    key={field.id}
                    field={field}
                    onFieldUpdate={(updater) =>
                      handleFieldUpdate(section.id, field.id, updater)
                    }
                  />
                ))}
              </FieldsGrid>
            ) : null}

            {index < sections.length - 1 ? <Divider /> : null}
          </Box>
        );
      })}
    </Card>
  );
};
