import { Handle, Position } from "@xyflow/react";
import { alpha, styled, useTheme } from "@mui/material/styles";
import { Box, Chip, Divider, Typography } from "@material-ui/core";
import ViewListIcon from "@mui/icons-material/ViewList";
import type { ParameterTitlesNodeData } from "./types";

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

const EmptyState = styled(Box)(({ theme }) => ({
  border: `2px dashed ${alpha(theme.palette.info.main, 0.5)}`,
  borderRadius: 12,
  padding: theme.spacing(3),
  textAlign: "center",
  color: alpha(theme.palette.text.primary, 0.7),
}));

export const ParameterTitlesNode: React.FC<{ data: ParameterTitlesNodeData }> = ({
  data,
}) => {
  const theme = useTheme();
  const sections = data.sections ?? [];

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
          label={`${sections.length} section${sections.length === 1 ? "" : "s"}`}
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

      {sections.length === 0 ? (
        <EmptyState>
          <Typography variant="body2">
            No parameter sections were detected. Add entries in your template
            YAML to see them listed here.
          </Typography>
        </EmptyState>
      ) : (
        sections.map((section, index) => {
          const propertyKeys = Object.keys(section.properties ?? {});
          return (
            <Box key={section.id ?? index}>
              <SectionRow>
                <Typography variant="subtitle1">
                  {section.title ?? `Untitled section ${index + 1}`}
                </Typography>
                {section.description ? (
                  <Typography variant="body2" color="textSecondary">
                    {section.description}
                  </Typography>
                ) : null}
                <SectionMeta>
                  <Chip
                    size="small"
                    label={`${propertyKeys.length} propert${
                      propertyKeys.length === 1 ? "y" : "ies"
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
              {index < sections.length - 1 ? <Divider /> : null}
            </Box>
          );
        })
      )}

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
