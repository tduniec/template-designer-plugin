import { useMemo, useState } from 'react';
import { Handle, Position, NodeToolbar } from '@xyflow/react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Button,
  Divider,
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

  onAddNode?: (afterRfId: string) => void;
  onUpdateField?: (rfId: string, field: keyof TaskStep, value: string) => void;
  onUpdateInput?: (rfId: string, key: string, value: string) => void;
  onRemoveInputKey?: (rfId: string, key: string) => void;
};

const Card = styled(Box)(({ theme }) => ({
  background: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: 12,
  width: 340,
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
  gridTemplateColumns: '100px 1fr auto',
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
  // TODO this is dummy so need to extend with call from API
  'fetch:template',
  'fetch:plain',
  'publish:catalog',
  'catalog:write',
];

export const ActionNode: React.FC<{ data: ActionNodeData }> = ({ data }) => {
  const { rfId, step } = data;
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  const theme = useTheme();
  const actionOptions =
    (data.scaffolderActionIds?.length ?? 0) > 0
      ? data.scaffolderActionIds ?? []
      : DEFAULT_ACTION_OPTIONS;

  // Always update by rfId (never by step.id)
  const handleTop =
    (field: keyof TaskStep) => (e: React.ChangeEvent<HTMLInputElement>) =>
      data.onUpdateField?.(rfId, field, e.target.value);

  const handleInput = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    data.onUpdateInput?.(rfId, k, e.target.value);

  const actionId = typeof step?.action === 'string' ? step.action : '';
  const actionInputOptions = useMemo(() => {
    if (!actionId) {
      return [] as { key: string; label: string }[];
    }
    const inputs = data.scaffolderActionInputsById?.[actionId] ?? {};
    return Object.keys(inputs).map(key => ({
      key,
      label: `${key}`,
    }));
  }, [actionId, data.scaffolderActionInputsById]);
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

  const addPair = () => {
    const k = trimmedNewKey;
    if (!k || usedInputKeys.has(k)) return;
    data.onUpdateInput?.(rfId, k, newVal);
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

        {inputEntries.map(([k, v]) => (
          <KvRow key={k}>
            <Typography
              variant="caption"
              noWrap
              title={k}
              color="textSecondary"
            >
              {k}
            </Typography>
            <TextField
              size="small"
              value={typeof v === 'string' ? v : JSON.stringify(v)}
              onChange={handleInput(k)}
              fullWidth
              {...stopAll}
            />
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
        ))}

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
          <TextField
            size="small"
            placeholder="new value"
            value={newVal}
            onChange={e => setNewVal(e.target.value)}
            fullWidth
            {...stopAll}
          />
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
