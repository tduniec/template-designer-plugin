import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import TextField from "@mui/material/TextField";

type FieldEditorDialogProps = {
  open: boolean;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onApply: () => void;
};

export const FieldEditorDialog = ({
  open,
  label,
  value,
  onChange,
  onClose,
  onApply,
}: FieldEditorDialogProps) => (
  <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
    <DialogTitle>{label ? `Edit ${label}` : "Edit field"}</DialogTitle>
    <DialogContent>
      <TextField
        multiline
        minRows={8}
        variant="outlined"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        fullWidth
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
      />
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>Cancel</Button>
      <Button color="primary" variant="contained" onClick={onApply}>
        Apply
      </Button>
    </DialogActions>
  </Dialog>
);
