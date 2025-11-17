import Popper from "@material-ui/core/Popper";
import type { PopperProps } from "@material-ui/core/Popper";

// Popper that allows Autocomplete dropdowns to expand beyond the input width while
// keeping a minimum width equal to the anchor element.
export const AutoWidthPopper = (props: PopperProps) => {
  const { style, anchorEl, ...restProps } = props;

  const anchorWidth =
    anchorEl && "clientWidth" in anchorEl
      ? (anchorEl as HTMLElement).clientWidth
      : undefined;

  return (
    <Popper
      {...restProps}
      anchorEl={anchorEl}
      style={{
        ...style,
        width: "auto",
        minWidth: anchorWidth ?? style?.minWidth,
      }}
    />
  );
};
