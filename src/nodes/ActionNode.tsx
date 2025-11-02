import React, { useMemo, useState } from 'react';
import { Handle, Position, NodeToolbar } from '@xyflow/react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Divider,
  Chip,
} from '@material-ui/core';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import type { TaskStep } from '@backstage/plugin-scaffolder-common';
import { useTheme } from '@mui/material/styles';
import Autocomplete from '@material-ui/lab/Autocomplete';

export type ActionNodeData = {
  /** Stable ReactFlow node id */
  rfId: string;
  /** User payload; id is editable string (reserved by your template) */
  step: TaskStep & { input?: Record<string, unknown> };
  /** Cached scaffolder action ids for dropdown options */
  scaffolderActionIds?: string[];
  /** Cached action input schemas keyed by action id */
  scaffolderActionInputsById?: Record<string, Record<string, unknown>>;
  /** Cached action output schemas keyed by action id */
  scaffolderActionOutputsById?: Record<string, Record<string, unknown>>;
  /** Suggestions for referencing previous step outputs */
  stepOutputReferences?: string[];

  onAddNode?: (afterRfId: string) => void;
  onUpdateField?: (rfId: string, field: keyof TaskStep, value: string) => void;
  onUpdateInput?: (rfId: string, key: string, value: unknown) => void;
  onRemoveInputKey?: (rfId: string, key: string) => void;
};

const Card = styled(Box)(({ theme }) => ({
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  width: 700, // card width
  padding: theme.spacing(1.5),
  boxShadow: theme.shadows[2],
  color: theme.palette.text.primary,
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '1fr',
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1),
}));

const Grid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '88px 1fr',
  gap: theme.spacing(1),
  alignItems: 'center',
}));

const KvRow = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: '200px 140px 1fr auto',
  gap: theme.spacing(1),
  alignItems: 'center',
}));

const ToolbarBtn = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  borderRadius: 8,
  paddingInline: theme.spacing(1),
  paddingBlock: 4,
}));

const DEFAULT_ACTION_OPTIONS = [
  'fetch:template', // TODO to be fixed later to not uses default actions
];

type JsonSchemaProperty = {
  type?: string | string[];
  enum?: unknown[];
  items?: JsonSchemaProperty | JsonSchemaProperty[];
} & Record<string, unknown>;

type NormalizedSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'array'
  | 'object'
  | 'unknown';

const capitalize = (value: string) =>
  value.length > 0 ? value[0].toUpperCase() + value.slice(1) : value;

const getFirstType = (
  type: string | string[] | undefined,
): NormalizedSchemaType => {
  if (!type) {
    return 'string';
  }
  const value = Array.isArray(type) ? type[0] : type;
  if (
    value === 'string' ||
    value === 'number' ||
    value === 'integer' ||
    value === 'boolean' ||
    value === 'array' ||
    value === 'object'
  ) {
    return value;
  }
  return 'string';
};

const normalizeSchemaType = (
  schema: JsonSchemaProperty | undefined,
): NormalizedSchemaType => {
  if (!schema || typeof schema !== 'object') {
    return 'string';
  }
  return getFirstType(schema.type);
};

const getArrayItemTypeLabel = (schema: JsonSchemaProperty | undefined) => {
  if (!schema) {
    return '';
  }
  const items = schema.items;
  if (!items) {
    return '';
  }
  if (Array.isArray(items)) {
    const [first] = items;
    if (!first) {
      return '';
    }
    return capitalize(normalizeSchemaType(first));
  }
  return capitalize(normalizeSchemaType(items));
};

const buildTypeLabel = (schema: JsonSchemaProperty | undefined) => {
  const normalized = normalizeSchemaType(schema);
  if (normalized === 'array') {
    const itemsLabel = getArrayItemTypeLabel(schema);
    return itemsLabel ? `Array<${itemsLabel}>` : 'Array';
  }
  if (normalized === 'integer') {
    return 'Integer';
  }
  if (normalized === 'unknown') {
    return 'Unknown';
  }
  return capitalize(normalized);
};

const stringifyValueForDisplay = (
  value: unknown,
  type: NormalizedSchemaType,
) => {
  if (value === undefined || value === null) {
    return '';
  }

  if (type === 'array' || type === 'object') {
    if (typeof value === 'string') {
      return value;
    }
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }

  return String(value);
};

const coerceValueForType = (
  raw: string,
  type: NormalizedSchemaType,
): unknown => {
  if (raw === '') {
    return '';
  }

  if (type === 'boolean') {
    if (raw === 'true') {
      return true;
    }
    if (raw === 'false') {
      return false;
    }
    return raw;
  }

  if (type === 'number' || type === 'integer') {
    const num = Number(raw);
    if (!Number.isNaN(num)) {
      return num;
    }
    return raw;
  }

  if (type === 'array' || type === 'object') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }

  return raw;
};

const extractEnumOptions = (schema: JsonSchemaProperty | undefined) => {
  if (!schema || !Array.isArray(schema.enum)) {
    return [] as string[];
  }
  return schema.enum
    .map(option => {
      if (option === undefined || option === null) {
        return '';
      }
      if (typeof option === 'object') {
        try {
          return JSON.stringify(option);
        } catch {
          return String(option);
        }
      }
      return String(option);
    })
    .filter(option => option !== '');
};

type ActionInputOption = {
  key: string;
  label: string;
  schema?: JsonSchemaProperty;
  type: NormalizedSchemaType;
};

export const ActionNode: React.FC<{ data: ActionNodeData }> = ({ data }) => {
  const { rfId, step } = data;
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');
  const stepOutputReferences = data.stepOutputReferences ?? [];

  const theme = useTheme();
  const actionOptions =
    (data.scaffolderActionIds?.length ?? 0) > 0
      ? data.scaffolderActionIds ?? []
      : DEFAULT_ACTION_OPTIONS;

  // Always update by rfId (never by step.id)
  const handleTop =
    (field: keyof TaskStep) => (e: React.ChangeEvent<HTMLInputElement>) =>
      data.onUpdateField?.(rfId, field, e.target.value);

  const actionId = typeof step?.action === 'string' ? step.action : '';
  const actionInputSchema = useMemo(() => {
    if (!actionId) {
      return {} as Record<string, JsonSchemaProperty>;
    }
    const inputs = (data.scaffolderActionInputsById?.[actionId] ??
      {}) as Record<string, JsonSchemaProperty>;
    return inputs;
  }, [actionId, data.scaffolderActionInputsById]);

  const actionInputOptions = useMemo<ActionInputOption[]>(() => {
    return Object.entries(actionInputSchema).map(([key, schema]) => {
      const normalized = normalizeSchemaType(schema);
      const label = buildTypeLabel(schema);
      return {
        key,
        label: label ? `${key} (${label})` : key,
        schema,
        type: normalized,
      };
    });
  }, [actionInputSchema]);
  const inputEntries = useMemo(
    () => Object.entries(step.input ?? {}),
    [step.input],
  );
  const usedInputKeys = useMemo(
    () => new Set(inputEntries.map(([key]) => key)),
    [inputEntries],
  );
  const availableInputOptions = useMemo(
    () => actionInputOptions.filter(option => !usedInputKeys.has(option.key)),
    [actionInputOptions, usedInputKeys],
  );
  const trimmedNewKey = newKey.trim();
  const selectedNewKeyOption = useMemo(
    () =>
      availableInputOptions.find(option => option.key === trimmedNewKey) ??
      null,
    [availableInputOptions, trimmedNewKey],
  );
  const isAddDisabled = !trimmedNewKey || usedInputKeys.has(trimmedNewKey);

  const newKeySchema =
    selectedNewKeyOption?.schema ??
    (trimmedNewKey ? actionInputSchema?.[trimmedNewKey] : undefined);
  const newKeyNormalizedType = normalizeSchemaType(newKeySchema);
  const newKeyTypeLabel = buildTypeLabel(newKeySchema) || 'String';
  const newKeyEnumOptions = extractEnumOptions(newKeySchema);
  const newValueOptions = Array.from(
    new Set([
      ...(newKeyNormalizedType === 'boolean' ? ['true', 'false'] : []),
      ...newKeyEnumOptions,
      ...stepOutputReferences,
    ]),
  );

  const addPair = () => {
    const k = trimmedNewKey;
    if (!k || usedInputKeys.has(k)) return;

    const schema =
      selectedNewKeyOption?.schema ??
      (actionInputSchema?.[k] as JsonSchemaProperty | undefined);
    const normalizedType = normalizeSchemaType(schema);
    const parsedValue = coerceValueForType(newVal, normalizedType);

    data.onUpdateInput?.(rfId, k, parsedValue);
    setNewKey('');
    setNewVal('');
  };

  // Make inputs editable inside ReactFlow
  const stopAll = {
    onPointerDown: (e: React.SyntheticEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => e.stopPropagation(),
    className: 'nodrag nowheel',
    inputProps: { 'data-nodrag': true },
  } as const;

  return (
    <Card>
      <Header title={step?.name || 'Unnamed Step'}>
        <Typography variant="subtitle2" noWrap>
          {step?.name || 'Unnamed Step'}
        </Typography>

        <Typography variant="caption" color="textSecondary">
          Action
        </Typography>
        <Autocomplete
          size="small"
          options={actionOptions}
          freeSolo
          value={typeof step?.action === 'string' ? step.action : ''}
          inputValue={typeof step?.action === 'string' ? step.action : ''}
          onChange={(_, newValue) =>
            data.onUpdateField?.(rfId, 'action', newValue ?? '')
          }
          onInputChange={(_, newInputValue) =>
            data.onUpdateField?.(rfId, 'action', newInputValue ?? '')
          }
          onPointerDown={stopAll.onPointerDown}
          onKeyDown={stopAll.onKeyDown}
          className={stopAll.className}
          fullWidth
          renderInput={params => (
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
        <ToolbarBtn
          variant="outlined"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => data.onAddNode?.(rfId)}
          onPointerDown={e => e.stopPropagation()}
          className="nodrag nowheel"
        >
          Add Node
        </ToolbarBtn>
      </NodeToolbar>

      <Divider />

      {/* ID / Name (task template id is editable by user) */}
      <Box sx={{ mb: 1 }}>
        <Grid>
          <Typography variant="caption" color="textSecondary">
            ID
          </Typography>
          <TextField
            size="small"
            placeholder="string id"
            value={String(step?.id ?? '')}
            onChange={handleTop('id')}
            fullWidth
            {...stopAll}
          />

          <Typography variant="caption" color="textSecondary">
            Name
          </Typography>
          <TextField
            size="small"
            placeholder="Step name"
            value={String(step?.name ?? '')}
            onChange={handleTop('name')}
            fullWidth
            {...stopAll}
          />
        </Grid>
      </Box>

      {/* Inputs */}
      <Typography variant="caption" color="textSecondary">
        Inputs
      </Typography>

      <Box sx={{ display: 'grid', mt: 0.5 }}>
        {inputEntries.length === 0 && (
          <Box
            sx={{
              fontSize: 12,
              color: theme.palette.text.secondary,
              border: `1px dashed ${theme.palette.divider}`,
              borderRadius: 1,
              p: 1,
              textAlign: 'center',
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
          const normalizedType = normalizeSchemaType(schema);
          const typeLabel = buildTypeLabel(schema) || 'String';
          const enumOptions = extractEnumOptions(schema);
          const baseOptions =
            normalizedType === 'boolean' ? ['true', 'false'] : [];
          const options = Array.from(
            new Set([...baseOptions, ...enumOptions, ...stepOutputReferences]),
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
              {(normalizedType === 'array' || normalizedType === 'object') && (
                <TextField
                  size="small"
                  value={displayValue}
                  onChange={event => handleStringChange(event.target.value)}
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
              {(normalizedType === 'number' ||
                normalizedType === 'integer') && (
                <TextField
                  size="small"
                  value={displayValue}
                  onChange={event => handleStringChange(event.target.value)}
                  placeholder="Number"
                  fullWidth
                  inputProps={{
                    ...stopAll.inputProps,
                    inputMode: 'decimal',
                  }}
                  onPointerDown={stopAll.onPointerDown}
                  onKeyDown={stopAll.onKeyDown}
                  className={stopAll.className}
                />
              )}
              {normalizedType !== 'array' &&
                normalizedType !== 'object' &&
                normalizedType !== 'number' &&
                normalizedType !== 'integer' && (
                  <Autocomplete
                    size="small"
                    freeSolo
                    options={options}
                    value={displayValue}
                    inputValue={displayValue}
                    fullWidth
                    onChange={(_, value) => handleStringChange(value ?? '')}
                    onInputChange={(_, value, reason) => {
                      if (reason === 'reset') {
                        return;
                      }
                      handleStringChange(value ?? '');
                    }}
                    onPointerDown={stopAll.onPointerDown}
                    onKeyDown={stopAll.onKeyDown}
                    className={stopAll.className}
                    renderInput={params => (
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
                onPointerDown={e => e.stopPropagation()}
                aria-label={`Remove ${k}`}
                className="nodrag nowheel"
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </KvRow>
          );
        })}

        {/* Add new key/value */}
        <KvRow>
          <Autocomplete
            size="small"
            freeSolo
            options={availableInputOptions}
            value={selectedNewKeyOption}
            inputValue={newKey}
            onChange={(_, value) => {
              if (!value) {
                setNewKey('');
                return;
              }
              if (typeof value === 'string') {
                setNewKey(value);
                return;
              }
              setNewKey(value.key);
            }}
            onInputChange={(_, value, reason) => {
              if (reason === 'reset') {
                return;
              }
              setNewKey(value ?? '');
            }}
            onPointerDown={stopAll.onPointerDown}
            onKeyDown={stopAll.onKeyDown}
            className={stopAll.className}
            getOptionSelected={(option, value) => option.key === value?.key}
            getOptionLabel={option =>
              typeof option === 'string' ? option : option.label
            }
            renderInput={params => (
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
            <Chip size="small" variant="outlined" label={newKeyTypeLabel} />
          </Box>
          {(newKeyNormalizedType === 'array' ||
            newKeyNormalizedType === 'object') && (
            <TextField
              size="small"
              value={newVal}
              onChange={event => setNewVal(event.target.value)}
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
          {(newKeyNormalizedType === 'number' ||
            newKeyNormalizedType === 'integer') && (
            <TextField
              size="small"
              value={newVal}
              onChange={event => setNewVal(event.target.value)}
              placeholder="Number"
              fullWidth
              inputProps={{
                ...stopAll.inputProps,
                inputMode: 'decimal',
              }}
              onPointerDown={stopAll.onPointerDown}
              onKeyDown={stopAll.onKeyDown}
              className={stopAll.className}
            />
          )}
          {newKeyNormalizedType !== 'array' &&
            newKeyNormalizedType !== 'object' &&
            newKeyNormalizedType !== 'number' &&
            newKeyNormalizedType !== 'integer' && (
              <Autocomplete
                size="small"
                freeSolo
                options={newValueOptions}
                value={newVal}
                inputValue={newVal}
                fullWidth
                onChange={(_, value) => setNewVal(value ?? '')}
                onInputChange={(_, value, reason) => {
                  if (reason === 'reset') {
                    return;
                  }
                  setNewVal(value ?? '');
                }}
                onPointerDown={stopAll.onPointerDown}
                onKeyDown={stopAll.onKeyDown}
                className={stopAll.className}
                renderInput={params => (
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
            onPointerDown={e => e.stopPropagation()}
            disabled={isAddDisabled}
            className="nodrag nowheel"
          >
            Add
          </Button>
        </KvRow>
      </Box>

      {/* ReactFlow handles */}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};
