import { Handle, NodeToolbar, Position } from "@xyflow/react";
import { memo } from "react";
import { alpha, styled, useTheme } from "@material-ui/core/styles";
import Autocomplete from "@material-ui/lab/Autocomplete";
import {
  Box,
  Button,
  Checkbox,
  Divider,
  FormControlLabel,
  IconButton,
  TextField,
  Typography,
  Chip,
} from "@material-ui/core";
import AddIcon from "@material-ui/icons/Add";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import type { OutputNodeData } from "../../types/flowNodes";
import { createStopNodeInteraction } from "./common/nodeInteraction";
import { useOutputController } from "./output/useOutputController";
import { AutoWidthPopper } from "./common/AutoWidthPopper";

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
      paletteMode === "dark" ? 0.16 : 0.09
    ),
    border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
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
        theme.palette.info.light,
        paletteMode === "dark" ? 0.28 : 0.16
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
      theme.palette.info.main,
      paletteMode === "dark" ? 0.24 : 0.14
    ),
    border: `1px solid ${alpha(theme.palette.info.main, 0.4)}`,
  };
});

const SectionHeader = styled(Box)(({ theme }) => {
  const paletteMode = resolvePaletteMode(theme);
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: theme.spacing(1.5),
    marginBottom: theme.spacing(0.5),
    padding: theme.spacing(0.75, 1),
    borderRadius: 8,
    backgroundColor: alpha(
      theme.palette.info.main,
      paletteMode === "dark" ? 0.18 : 0.1
    ),
  };
});

const Row = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr) auto",
  gap: theme.spacing(1),
  alignItems: "center",
  marginBottom: theme.spacing(1),
}));

const TextRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
  alignItems: "flex-start",
}));

const OutputNodeComponent: React.FC<{ data: OutputNodeData }> = ({ data }) => {
  if (process.env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console
    console.debug("[DesignerFlow] render OutputNode", data.rfId);
  }
  const theme = useTheme();
  const paletteMode = resolvePaletteMode(theme);
  const stopAll = createStopNodeInteraction();
  const {
    stepOutputReferences,
    referenceOptions,
    links,
    textEntries,
    setLinkFieldValue,
    handleLinkChange,
    handleAddLink,
    handleRemoveLink,
    setTextFieldValue,
    handleTextChange,
    handleTextDefaultToggle,
    handleAddText,
    handleRemoveText,
  } = useOutputController(data);

  return (
    <Card>
      <Handle type="target" position={Position.Top} />
      <Header>
        <Box display="flex" alignItems="center">
          <MoveToInboxIcon
            fontSize="small"
            htmlColor={theme.palette.info.main}
          />
          <Typography variant="subtitle2" noWrap>
            Template Output
          </Typography>
        </Box>
        <Chip
          size="small"
          variant="outlined"
          label="Result"
          style={{
            borderColor: theme.palette.info.main,
            color:
              paletteMode === "dark"
                ? theme.palette.info.light
                : theme.palette.info.dark,
          }}
        />
      </Header>

      <Divider style={{ margin: "8px 0", opacity: 0.5 }} />

      <SectionHeader>
        <Typography variant="caption" color="textSecondary">
          Links
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={handleAddLink}
          onPointerDown={stopAll.onPointerDown}
          onKeyDown={stopAll.onKeyDown}
          className={stopAll.className}
        >
          Add Link
        </Button>
      </SectionHeader>

      {links.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No links yet
        </Typography>
      )}

      {links.map((link, index) => (
        <Row key={`link-${index}`}>
          <TextField
            {...stopAll}
            size="small"
            label="Title"
            placeholder="Link title"
            value={link.title ?? ""}
            onChange={handleLinkChange(index, "title")}
          />
          <TextField
            {...stopAll}
            size="small"
            label="Icon"
            placeholder="catalog"
            value={link.icon ?? ""}
            onChange={handleLinkChange(index, "icon")}
          />
          <Autocomplete
            size="small"
            freeSolo
            options={referenceOptions}
            PopperComponent={AutoWidthPopper}
            value={
              link.url === undefined || link.url === null
                ? ""
                : String(link.url)
            }
            inputValue={
              link.url === undefined || link.url === null
                ? ""
                : String(link.url)
            }
            fullWidth
            onChange={(_, value) =>
              setLinkFieldValue(index, "url", value ?? "")
            }
            onInputChange={(_, value, reason) => {
              if (reason === "reset") {
                return;
              }
              setLinkFieldValue(index, "url", value ?? "");
            }}
            onPointerDown={stopAll.onPointerDown}
            onKeyDown={stopAll.onKeyDown}
            className={stopAll.className}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                label="URL"
                placeholder="https://example.com"
                inputProps={{
                  ...params.inputProps,
                  ...stopAll.inputProps,
                }}
              />
            )}
          />
          <TextField
            {...stopAll}
            size="small"
            label="Entity Ref"
            placeholder="component:default/example"
            value={link.entityRef ?? ""}
            onChange={handleLinkChange(index, "entityRef")}
          />
          <IconButton
            size="small"
            onPointerDown={stopAll.onPointerDown}
            onClick={() => handleRemoveLink(index)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Row>
      ))}

      <SectionHeader>
        <Typography variant="caption" color="textSecondary">
          Text
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={handleAddText}
          onPointerDown={stopAll.onPointerDown}
          onKeyDown={stopAll.onKeyDown}
          className={stopAll.className}
        >
          Add Text
        </Button>
      </SectionHeader>

      {textEntries.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No text snippets yet
        </Typography>
      )}

      {textEntries.map((entry, index) => (
        <Box key={`text-${index}`} sx={{ mb: 1 }}>
          <TextRow>
            <TextField
              {...stopAll}
              size="small"
              label="Title"
              value={entry.title ?? ""}
              onChange={handleTextChange(index, "title")}
            />
            <TextField
              {...stopAll}
              size="small"
              label="Icon"
              value={entry.icon ?? ""}
              onChange={handleTextChange(index, "icon")}
            />
            <Autocomplete
              size="small"
              freeSolo
              options={referenceOptions}
              PopperComponent={AutoWidthPopper}
              value={
                entry.content === undefined || entry.content === null
                  ? ""
                  : String(entry.content)
              }
              inputValue={
                entry.content === undefined || entry.content === null
                  ? ""
                  : String(entry.content)
              }
              fullWidth
              onChange={(_, value) =>
                setTextFieldValue(index, "content", value ?? "")
              }
              onInputChange={(_, value, reason) => {
                if (reason === "reset") {
                  return;
                }
                setTextFieldValue(index, "content", value ?? "");
              }}
              onPointerDown={stopAll.onPointerDown}
              onKeyDown={stopAll.onKeyDown}
              className={stopAll.className}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Content"
                  placeholder="Content"
                  multiline
                  minRows={2}
                  inputProps={{
                    ...params.inputProps,
                    ...stopAll.inputProps,
                  }}
                />
              )}
            />
          </TextRow>
          <Box display="flex" alignItems="center">
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={Boolean(entry.default)}
                  onChange={() => handleTextDefaultToggle(index)}
                  {...stopAll}
                />
              }
              label="Default"
            />
            <IconButton
              size="small"
              onPointerDown={stopAll.onPointerDown}
              onClick={() => handleRemoveText(index)}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      ))}

      {stepOutputReferences.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="textSecondary">
            Available step output references
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", mt: 0.5 }}>
            {stepOutputReferences.map((reference) => (
              <Chip
                key={reference}
                label={reference}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      )}

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
          onPointerDown={stopAll.onPointerDown}
          onKeyDown={stopAll.onKeyDown}
          className="nodrag nowheel"
        >
          Add Action Above
        </Button>
      </NodeToolbar>
    </Card>
  );
};

export const OutputNode = memo(OutputNodeComponent);
