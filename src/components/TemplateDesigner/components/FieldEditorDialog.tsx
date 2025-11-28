import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@material-ui/core";
import { useEffect, useRef } from "react";

type FieldEditorDialogProps = {
  open: boolean;
  label?: string;
  value: string;
  onClose: () => void;
  onApply: (value: string) => void;
};

export const FieldEditorDialog = ({
  open,
  label,
  value,
  onClose,
  onApply,
}: FieldEditorDialogProps) => {
  const draftRef = useRef(value);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      draftRef.current = value;
      if (inputRef.current) {
        inputRef.current.value = value;
      }
    }
  }, [open, value]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{label ? `Edit ${label}` : "Edit field"}</DialogTitle>
      <DialogContent>
        <TextField
          multiline
          minRows={8}
          variant="outlined"
          defaultValue={value}
          inputRef={inputRef}
          onChange={(event) => {
            draftRef.current = event.target.value;
          }}
          fullWidth
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="primary"
          variant="contained"
          onClick={() => onApply(draftRef.current ?? value)}
        >
          Apply
        </Button>
      </DialogActions>
    </Dialog>
  );
};
