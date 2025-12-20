import { memo, useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { Handle, Position, NodeToolbar } from "@xyflow/react";
import { styled, useTheme } from "@material-ui/core/styles";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Divider,
  Chip,
} from "@material-ui/core";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import AddIcon from "@material-ui/icons/Add";
import type { TaskStep } from "@backstage/plugin-scaffolder-common";
import Autocomplete from "@material-ui/lab/Autocomplete";
import type { ActionNodeData } from "../../types/flowNodes";
import type { JsonSchemaProperty } from "./action/schema";
import {
  coerceValueForType,
  extractEnumOptions,
  buildTypeLabel,
  normalizeSchemaType,
  stringifyValueForDisplay,
} from "./action/schema";
import { useActionInputs } from "./action/useActionInputs";
import { createStopNodeInteraction } from "./common/nodeInteraction";
import { AutoWidthPopper } from "./common/AutoWidthPopper";

const Card = styled(Box)(({ theme }) => ({
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  width: 760, // card width
  padding: theme.spacing(1.5),
  boxShadow: theme.shadows[2],
  color: theme.palette.text.primary,
}));

const Header = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

const Grid = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "88px 1fr",
  gap: theme.spacing(1),
  alignItems: "center",
}));

const KvRow = styled(Box)(({ theme }) => ({
  display: "grid",
  gridTemplateColumns: "200px 140px 1fr auto",
  gap: theme.spacing(1),
  alignItems: "center",
}));

const DEFAULT_ACTION_OPTIONS = [
  "fetch:template", // TODO to be fixed later to not uses default actions
];

const ActionNodeComponent: React.FC<{ data: ActionNodeData }> = ({ data }) => {
  const { rfId, step } = data;
  if (process.env.NODE_ENV === "development") {
    // Helps confirm rerender counts per node without shipping console noise to production.
    // eslint-disable-next-line no-console
    console.debug("[DesignerFlow] render ActionNode", rfId);
  }
  const [newKey, setNewKey] = useState("");
  const [newVal, setNewVal] = useState("");
  const stepOutputReferences = data.stepOutputReferences ?? [];
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const deleteConfirmationTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  const theme = useTheme();
  const actionOptions =
    (data.scaffolderActionIds?.length ?? 0) > 0
      ? data.scaffolderActionIds ?? []
      : DEFAULT_ACTION_OPTIONS;

  const handleTop =
    (field: keyof TaskStep) => (e: ChangeEvent<HTMLInputElement>) =>
      data.onUpdateField?.(rfId, field, e.target.value);

  const actionId = typeof step?.action === "string" ? step.action : "";
  const [actionInputValue, setActionInputValue] = useState(actionId);

  useEffect(() => {
    setActionInputValue(actionId);
  }, [actionId]);

  const {
    actionInputSchema,
    inputEntries,
    usedInputKeys,
    missingRequiredInputKeys,
    availableInputOptions,
    trimmedNewKey,
    selectedNewKeyOption,
    newKeyNormalizedType,
    newKeyTypeLabel,
    newKeyEnumOptions,
  } = useActionInputs({ data, step, actionId, newKey });
  const displayedNewKeyTypeLabel = newKeyTypeLabel || "Any";
  const hasMissingRequiredInputs = missingRequiredInputKeys.length > 0;
  const isAddDisabled = !trimmedNewKey || usedInputKeys.has(trimmedNewKey);
  const newValueOptions = Array.from(
    new Set([
      ...(newKeyNormalizedType === "boolean" ? ["true", "false"] : []),
      ...newKeyEnumOptions,
      ...stepOutputReferences,
    ])
  );
  const paletteMode =
    (theme.palette as { mode?: "light" | "dark" }).mode ??
    theme.palette.type ??
    "light";
  const requiredInputsBackground =
    paletteMode === "dark"
      ? "rgba(244, 67, 54, 0.2)"
      : "rgba(244, 67, 54, 0.08)";

  const addPair = () => {
    const k = trimmedNewKey;
    if (!k || usedInputKeys.has(k)) return;

    const schema =
      selectedNewKeyOption?.schema ??
      (actionInputSchema?.[k] as JsonSchemaProperty | undefined);
    const normalizedType = normalizeSchemaType(schema);
    const parsedValue = coerceValueForType(newVal, normalizedType);

    data.onUpdateInput?.(rfId, k, parsedValue);
    setNewKey("");
    setNewVal("");
  };

  const stopAll = createStopNodeInteraction();

  useEffect(() => {
    if (!isConfirmingDelete) {
      if (deleteConfirmationTimeoutRef.current) {
        clearTimeout(deleteConfirmationTimeoutRef.current);
        deleteConfirmationTimeoutRef.current = null;
      }
      return undefined;
    }
    deleteConfirmationTimeoutRef.current = setTimeout(() => {
      setIsConfirmingDelete(false);
      deleteConfirmationTimeoutRef.current = null;
    }, 3500);
    return () => {
      if (deleteConfirmationTimeoutRef.current) {
        clearTimeout(deleteConfirmationTimeoutRef.current);
        deleteConfirmationTimeoutRef.current = null;
      }
    };
  }, [isConfirmingDelete]);

  const handleDeleteNode = () => {
    if (!data.onRemoveNode) {
      return;
    }
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    data.onRemoveNode(rfId);
    setIsConfirmingDelete(false);
  };

  return (
    <Card>
      <Header title={step?.name || "Unnamed Step"}>
        <Box
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: theme.spacing(1),
          }}
        >
          <Typography variant="subtitle2" noWrap>
            {step?.name || "Unnamed Step"}
          </Typography>
          {data.onRemoveNode && (
            <Box
              style={{
                display: "flex",
                alignItems: "center",
                gap: theme.spacing(0.5),
                color: theme.palette.text.secondary,
              }}
            >
              {isConfirmingDelete && (
                <Typography variant="caption" color="error">
                  Click again to delete
                </Typography>
              )}
              <IconButton
                size="small"
                onClick={handleDeleteNode}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Remove action"
                color={isConfirmingDelete ? "secondary" : "default"}
                className="nodrag nowheel"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
          )}
        </Box>

        <Typography variant="caption" color="textSecondary">
          Action
        </Typography>
        <Autocomplete
          size="small"
          options={actionOptions}
          PopperComponent={AutoWidthPopper}
          freeSolo
          autoHighlight
          value={actionId}
          inputValue={actionInputValue}
          filterOptions={(options) => {
            const needle = actionInputValue.trim().toLowerCase();
            if (!needle) {
              return options;
            }
            return options.filter((opt) => opt.toLowerCase().includes(needle));
          }}
          onChange={(_, newValue) => {
            const nextValue = newValue ?? "";
            setActionInputValue(nextValue);
            data.onUpdateField?.(rfId, "action", nextValue);
          }}
          onInputChange={(_, newInputValue, reason) => {
            if (reason === "reset") {
              return;
            }
            const nextValue = newInputValue ?? "";
            setActionInputValue(nextValue);
            data.onUpdateField?.(rfId, "action", nextValue);
          }}
          onPointerDown={stopAll.onPointerDown}
          onKeyDown={stopAll.onKeyDown}
          className={stopAll.className}
          fullWidth
          renderInput={(params) => (
            <TextField
              {...params}
              size="small"
              placeholder="e.g. fetch:template"
              fullWidth
              inputProps={{
                ...params.inputProps,
                ...stopAll.inputProps,
              }}
            />
          )}
        />
      </Header>

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
          onPointerDown={(e) => e.stopPropagation()}
          className="nodrag nowheel"
        >
          Add Action
        </Button>
      </NodeToolbar>

      <Divider />

      <Box sx={{ mb: 1 }}>
        <Grid>
          <Typography variant="caption" color="textSecondary">
            ID
          </Typography>
          <TextField
            size="small"
            placeholder="string id"
            value={String(step?.id ?? "")}
            onChange={handleTop("id")}
            fullWidth
            {...stopAll}
          />

          <Typography variant="caption" color="textSecondary">
            Name
          </Typography>
          <TextField
            size="small"
            placeholder="Step name"
            value={String(step?.name ?? "")}
            onChange={handleTop("name")}
            fullWidth
            {...stopAll}
          />
        </Grid>
      </Box>

      <Typography variant="caption" color="textSecondary">
        Inputs
      </Typography>

      <Box sx={{ display: "grid", mt: 0.5 }}>
        {inputEntries.length === 0 && (
          <Box
            sx={{
              fontSize: 12,
              color: theme.palette.text.secondary,
              border: `1px dashed ${theme.palette.divider}`,
              borderRadius: 1,
              p: 1,
              textAlign: "center",
            }}
          >
            No inputs yet
          </Box>
        )}

        <KvRow
          sx={{
            mt: inputEntries.length === 0 ? 1.5 : 0.5,
            color: theme.palette.text.secondary,
          }}
        >
          <Typography variant="caption" color="textSecondary">
            Key
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Type
          </Typography>
          <Typography variant="caption" color="textSecondary">
            Value
          </Typography>
          <Box />
        </KvRow>

        {inputEntries.map(([k, v]) => {
          const schema = actionInputSchema?.[k];
          const normalizedType = normalizeSchemaType(schema, v);
          const fallbackTypeLabel =
            normalizedType === "unknown"
              ? "Unknown"
              : normalizedType[0].toUpperCase() + normalizedType.slice(1);
          const typeLabel = buildTypeLabel(schema) || fallbackTypeLabel;
          const enumOptions = extractEnumOptions(schema);
          const baseOptions =
            normalizedType === "boolean" ? ["true", "false"] : [];
          const options = Array.from(
            new Set([...baseOptions, ...enumOptions, ...stepOutputReferences])
          );
          const displayValue = stringifyValueForDisplay(v, normalizedType);
          const handleStringChange = (nextValue: string) => {
            const parsed = coerceValueForType(nextValue, normalizedType);
            data.onUpdateInput?.(rfId, k, parsed);
          };

          return (
            <KvRow key={k}>
              <Typography
                variant="caption"
                noWrap
                title={k}
                color="textSecondary"
              >
                {k}
              </Typography>
              <Box display="flex">
                <Chip size="small" variant="outlined" label={typeLabel} />
              </Box>
              {(normalizedType === "array" || normalizedType === "object") && (
                <TextField
                  size="small"
                  value={displayValue}
                  onChange={(event) => handleStringChange(event.target.value)}
                  placeholder="JSON value"
                  fullWidth
                  multiline
                  minRows={2}
                  inputProps={{
                    ...stopAll.inputProps,
                  }}
                  onPointerDown={stopAll.onPointerDown}
                  onKeyDown={stopAll.onKeyDown}
                  className={stopAll.className}
                />
              )}
              {(normalizedType === "number" ||
                normalizedType === "integer") && (
                <TextField
                  size="small"
                  value={displayValue}
                  onChange={(event) => handleStringChange(event.target.value)}
                  placeholder="Number"
                  fullWidth
                  inputProps={{
                    ...stopAll.inputProps,
                    inputMode: "decimal",
                  }}
                  onPointerDown={stopAll.onPointerDown}
                  onKeyDown={stopAll.onKeyDown}
                  className={stopAll.className}
                />
              )}
              {normalizedType !== "array" &&
                normalizedType !== "object" &&
                normalizedType !== "number" &&
                normalizedType !== "integer" && (
                  <Autocomplete
                    size="small"
                    freeSolo
                    options={options}
                    PopperComponent={AutoWidthPopper}
                    value={displayValue}
                    inputValue={displayValue}
                    fullWidth
                    onChange={(_, value) => handleStringChange(value ?? "")}
                    onInputChange={(_, value, reason) => {
                      if (reason === "reset") {
                        return;
                      }
                      handleStringChange(value ?? "");
                    }}
                    onPointerDown={stopAll.onPointerDown}
                    onKeyDown={stopAll.onKeyDown}
                    className={stopAll.className}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        placeholder="value"
                        inputProps={{
                          ...params.inputProps,
                          ...stopAll.inputProps,
                        }}
                      />
                    )}
                  />
                )}
              <IconButton
                size="small"
                onClick={() => data.onRemoveInputKey?.(rfId, k)}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label={`Remove ${k}`}
                className="nodrag nowheel"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </KvRow>
          );
        })}

        <KvRow>
          <Autocomplete
            size="small"
            freeSolo
            options={availableInputOptions}
            PopperComponent={AutoWidthPopper}
            value={selectedNewKeyOption}
            inputValue={newKey}
            filterOptions={(options) => {
              const needle = newKey.trim().toLowerCase();
              if (!needle) {
                return options;
              }
              return options.filter((option) =>
                (typeof option === "string" ? option : option.label)
                  .toLowerCase()
                  .includes(needle)
              );
            }}
            onChange={(_, value) => {
              if (!value) {
                setNewKey("");
                return;
              }
              if (typeof value === "string") {
                setNewKey(value);
                return;
              }
              setNewKey(value.key);
            }}
            onInputChange={(_, value, reason) => {
              if (reason === "reset") {
                return;
              }
              setNewKey(value ?? "");
            }}
            onPointerDown={stopAll.onPointerDown}
            onKeyDown={stopAll.onKeyDown}
            className={stopAll.className}
            getOptionSelected={(
              option: { key: string },
              value: { key?: string } | null
            ) => option.key === value?.key}
            getOptionLabel={(option) =>
              typeof option === "string" ? option : option.label
            }
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                placeholder="new key"
                inputProps={{
                  ...params.inputProps,
                  ...stopAll.inputProps,
                }}
              />
            )}
          />
          <Box display="flex">
            <Chip
              size="small"
              variant="outlined"
              label={displayedNewKeyTypeLabel}
            />
          </Box>
          {(newKeyNormalizedType === "array" ||
            newKeyNormalizedType === "object") && (
            <TextField
              size="small"
              value={newVal}
              onChange={(event) => setNewVal(event.target.value)}
              placeholder="JSON value"
              fullWidth
              multiline
              minRows={2}
              inputProps={{
                ...stopAll.inputProps,
              }}
              onPointerDown={stopAll.onPointerDown}
              onKeyDown={stopAll.onKeyDown}
              className={stopAll.className}
            />
          )}
          {(newKeyNormalizedType === "number" ||
            newKeyNormalizedType === "integer") && (
            <TextField
              size="small"
              value={newVal}
              onChange={(event) => setNewVal(event.target.value)}
              placeholder="Number"
              fullWidth
              inputProps={{
                ...stopAll.inputProps,
                inputMode: "decimal",
              }}
              onPointerDown={stopAll.onPointerDown}
              onKeyDown={stopAll.onKeyDown}
              className={stopAll.className}
            />
          )}
          {newKeyNormalizedType !== "array" &&
            newKeyNormalizedType !== "object" &&
            newKeyNormalizedType !== "number" &&
            newKeyNormalizedType !== "integer" && (
              <Autocomplete
                size="small"
                freeSolo
                options={newValueOptions}
                PopperComponent={AutoWidthPopper}
                value={newVal}
                inputValue={newVal}
                fullWidth
                filterOptions={(options) => {
                  const needle = newVal.trim().toLowerCase();
                  if (!needle) {
                    return options;
                  }
                  return options.filter((option) => {
                    const raw = String(option);
                    const normalized = raw
                      .replace(/^\s*\$\{\{\s*/, "")
                      .replace(/\s*\}\}\s*$/, "");
                    const haystacks = [
                      raw.toLowerCase(),
                      normalized.toLowerCase(),
                    ];
                    return haystacks.some((haystack) =>
                      haystack.includes(needle)
                    );
                  });
                }}
                onChange={(_, value) => setNewVal(value ?? "")}
                onInputChange={(_, value, reason) => {
                  if (reason === "reset") {
                    return;
                  }
                  setNewVal(value ?? "");
                }}
                onPointerDown={stopAll.onPointerDown}
                onKeyDown={stopAll.onKeyDown}
                className={stopAll.className}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    placeholder="new value"
                    inputProps={{
                      ...params.inputProps,
                      ...stopAll.inputProps,
                    }}
                  />
                )}
              />
            )}
          <Button
            size="small"
            variant="contained"
            onClick={addPair}
            onPointerDown={(e) => e.stopPropagation()}
            disabled={isAddDisabled}
            className="nodrag nowheel"
          >
            Add
          </Button>
        </KvRow>
      </Box>

      {hasMissingRequiredInputs && (
        <Box
          sx={{
            mt: 1.5,
            p: 1,
            borderRadius: 1,
            border: `1px solid ${theme.palette.error.main}`,
          }}
          style={{ backgroundColor: requiredInputsBackground }}
        >
          <Typography variant="caption" color="error">
            Missing required inputs
          </Typography>
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              mt: 0.75,
            }}
            style={{ gap: theme.spacing(0.5) }}
          >
            {missingRequiredInputKeys.map((key) => (
              <Chip
                key={key}
                size="small"
                variant="outlined"
                label={key}
                style={{
                  borderColor: theme.palette.error.main,
                  color: theme.palette.error.main,
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};

export const ActionNode = memo(ActionNodeComponent);
