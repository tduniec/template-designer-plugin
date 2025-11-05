import { useMemo, useState } from "react";
import type {
  ChangeEvent,
  InputHTMLAttributes,
  KeyboardEvent,
  SyntheticEvent,
} from "react";
import { Handle, NodeToolbar, Position } from "@xyflow/react";
import { alpha, styled, useTheme } from "@mui/material/styles";
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
import Autocomplete from "@material-ui/lab/Autocomplete";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import OutboxIcon from "@mui/icons-material/Outbox";
import type { OutputNodeData } from "./types";

const Card = styled(Box)(({ theme }) => ({
  position: "relative",
  background: alpha(
    theme.palette.info.main,
    theme.palette.mode === "dark" ? 0.16 : 0.09
  ),
  border: `1px solid ${alpha(theme.palette.info.main, 0.3)}`,
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
      theme.palette.info.light,
      theme.palette.mode === "dark" ? 0.28 : 0.16
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
    theme.palette.info.main,
    theme.palette.mode === "dark" ? 0.24 : 0.14
  ),
  border: `1px solid ${alpha(theme.palette.info.main, 0.4)}`,
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: theme.spacing(1.5),
  marginBottom: theme.spacing(0.5),
  padding: theme.spacing(0.75, 1),
  borderRadius: 8,
  backgroundColor: alpha(
    theme.palette.info.main,
    theme.palette.mode === "dark" ? 0.18 : 0.1
  ),
}));

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

const CustomRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "160px 1fr auto",
  gap: theme.spacing(1),
  alignItems: "center",
  marginBottom: theme.spacing(1),
}));

const BUILTIN_KEYS = new Set(["links", "text"]);

export const OutputNode: React.FC<{ data: OutputNodeData }> = ({ data }) => {
  const theme = useTheme();
  const { rfId, output } = data;
  const [newCustomKey, setNewCustomKey] = useState("");
  const [newCustomValue, setNewCustomValue] = useState("");
  const stepOutputReferences = useMemo(
    () => data.stepOutputReferences ?? [],
    [data.stepOutputReferences]
  );
  const referenceOptions = useMemo(
    () => Array.from(new Set(stepOutputReferences.filter(Boolean))),
    [stepOutputReferences]
  );

  const stopAll: {
    onPointerDown: (event: SyntheticEvent) => void;
    onKeyDown: (event: KeyboardEvent) => void;
    className: string;
    inputProps: InputHTMLAttributes<HTMLInputElement> & {
      [key: string]: unknown;
    };
  } = {
    onPointerDown: (event: SyntheticEvent) => event.stopPropagation(),
    onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
    className: "nodrag nowheel",
    inputProps: { "data-nodrag": true },
  };

  const links = useMemo(
    () => (Array.isArray(output?.links) ? [...output.links] : []),
    [output?.links]
  );

  const textEntries = useMemo(
    () => (Array.isArray(output?.text) ? [...output.text] : []),
    [output?.text]
  );

  const customEntries = useMemo(() => {
    if (!output || typeof output !== "object") {
      return [] as Array<[string, unknown]>;
    }
    return Object.entries(output).filter(([key]) => !BUILTIN_KEYS.has(key));
  }, [output]);

  const updateOutput = (
    updater: (prev: OutputNodeData["output"]) => OutputNodeData["output"]
  ) => data.onUpdateOutput?.(rfId, updater);

  const handleCustomValueChange =
    (key: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      updateOutput((prev) => ({
        ...prev,
        [key]: raw,
      }));
    };

  const handleRemoveCustom = (key: string) => {
    updateOutput((prev) => {
      const next = { ...(prev ?? {}) };
      delete next[key];
      return next;
    });
  };

  const handleAddCustom = () => {
    const trimmedKey = newCustomKey.trim();
    if (!trimmedKey || BUILTIN_KEYS.has(trimmedKey)) {
      return;
    }
    updateOutput((prev) => {
      if (prev && Object.prototype.hasOwnProperty.call(prev, trimmedKey)) {
        return prev;
      }
      return {
        ...(prev ?? {}),
        [trimmedKey]: newCustomValue,
      };
    });
    setNewCustomKey("");
    setNewCustomValue("");
  };

  const setLinkFieldValue = (
    index: number,
    field: "title" | "icon" | "url" | "entityRef",
    value: string
  ) => {
    const normalized = value ?? "";
    updateOutput((prev) => {
      const currentLinks = Array.isArray(prev?.links) ? [...prev.links] : [];
      const target = { ...(currentLinks[index] ?? {}) };
      target[field] = normalized;
      currentLinks[index] = target;
      return { ...(prev ?? {}), links: currentLinks };
    });
  };

  const handleLinkChange =
    (index: number, field: "title" | "icon" | "url" | "entityRef") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setLinkFieldValue(index, field, event.target.value);
    };

  const handleRemoveLink = (index: number) => {
    updateOutput((prev) => {
      const currentLinks = Array.isArray(prev?.links) ? [...prev.links] : [];
      currentLinks.splice(index, 1);
      if (currentLinks.length === 0) {
        const { links: _removed, ...rest } = prev ?? {};
        return rest;
      }
      return { ...(prev ?? {}), links: currentLinks };
    });
  };

  const handleAddLink = () => {
    updateOutput((prev) => {
      const currentLinks = Array.isArray(prev?.links) ? [...prev.links] : [];
      currentLinks.push({ title: "", url: "" });
      return { ...(prev ?? {}), links: currentLinks };
    });
  };

  const setTextFieldValue = (
    index: number,
    field: "title" | "icon" | "content",
    value: string
  ) => {
    const normalized = value ?? "";
    updateOutput((prev) => {
      const currentText = Array.isArray(prev?.text) ? [...prev.text] : [];
      const target = { ...(currentText[index] ?? {}) };
      target[field] = normalized;
      currentText[index] = target;
      return { ...(prev ?? {}), text: currentText };
    });
  };

  const handleTextChange =
    (index: number, field: "title" | "icon" | "content") =>
    (event: ChangeEvent<HTMLInputElement>) => {
      setTextFieldValue(index, field, event.target.value);
    };

  const handleTextDefaultToggle = (index: number) => {
    updateOutput((prev) => {
      const currentText = Array.isArray(prev?.text) ? [...prev.text] : [];
      const target = { ...(currentText[index] ?? {}) };
      target.default = !target.default;
      currentText[index] = target;
      return { ...(prev ?? {}), text: currentText };
    });
  };

  const handleRemoveText = (index: number) => {
    updateOutput((prev) => {
      const currentText = Array.isArray(prev?.text) ? [...prev.text] : [];
      currentText.splice(index, 1);
      if (currentText.length === 0) {
        const { text: _removed, ...rest } = prev ?? {};
        return rest;
      }
      return { ...(prev ?? {}), text: currentText };
    });
  };

  const handleAddText = () => {
    updateOutput((prev) => {
      const currentText = Array.isArray(prev?.text) ? [...prev.text] : [];
      currentText.push({ title: "", content: "" });
      return { ...(prev ?? {}), text: currentText };
    });
  };

  return (
    <Card>
      <Header>
        <Box display="flex" alignItems="center">
          <OutboxIcon fontSize="small" htmlColor={theme.palette.info.main} />
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
              theme.palette.mode === "dark"
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

      <SectionHeader>
        <Typography variant="caption" color="textSecondary">
          Custom Output Keys
        </Typography>
      </SectionHeader>

      {customEntries.length === 0 && (
        <Typography variant="body2" color="textSecondary">
          No custom output keys
        </Typography>
      )}

      {customEntries.map(([key, value]) => (
        <CustomRow key={key}>
          <Typography variant="body2" noWrap title={key}>
            {key}
          </Typography>
          <TextField
            {...stopAll}
            size="small"
            placeholder="Value"
            value={value === undefined || value === null ? "" : String(value)}
            onChange={handleCustomValueChange(key)}
            select={false}
          />
          <IconButton
            size="small"
            onPointerDown={stopAll.onPointerDown}
            onClick={() => handleRemoveCustom(key)}
          >
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </CustomRow>
      ))}

      <Box
        sx={{ mt: 1, display: "grid", gridTemplateColumns: "160px 1fr auto" }}
      >
        <TextField
          {...stopAll}
          size="small"
          label="Key"
          value={newCustomKey}
          onChange={(event) => setNewCustomKey(event.target.value)}
        />
        <TextField
          {...stopAll}
          size="small"
          label="Value"
          value={newCustomValue}
          onChange={(event) => setNewCustomValue(event.target.value)}
          placeholder="e.g. ${{ steps.stepId.output.value }}"
        />
        <Button
          variant="outlined"
          size="small"
          onClick={handleAddCustom}
          onPointerDown={stopAll.onPointerDown}
          onKeyDown={stopAll.onKeyDown}
          className={stopAll.className}
        >
          Add Key
        </Button>
      </Box>

      {stepOutputReferences.length > 0 && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="textSecondary">
            Available step output references
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              mt: 0.5,
            }}
          >
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
              afterRfId: rfId,
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

      <Handle type="target" position={Position.Top} />
    </Card>
  );
};
