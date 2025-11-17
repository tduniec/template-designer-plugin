import type { KeyboardEvent, SyntheticEvent } from "react";

export type StopNodeInteraction = {
  onPointerDown: (event: SyntheticEvent) => void;
  onKeyDown: (event: KeyboardEvent) => void;
  className: string;
  inputProps: { [key: string]: unknown };
};

export const createStopNodeInteraction = (): StopNodeInteraction => ({
  onPointerDown: (event: SyntheticEvent) => event.stopPropagation(),
  onKeyDown: (event: KeyboardEvent) => event.stopPropagation(),
  className: "nodrag nowheel",
  inputProps: { "data-nodrag": true },
});
