import { Popper } from "@material-ui/core";
import type { PopperProps } from "@material-ui/core";

// Popper that matches the width of the input for nicer Autocomplete menus.
export const AutoWidthPopper = (props: PopperProps) => {
  const { anchorEl } = props;
  const width = (anchorEl as HTMLElement | null)?.clientWidth ?? undefined;
  return <Popper {...props} style={{ width, ...props.style }} />;
};
