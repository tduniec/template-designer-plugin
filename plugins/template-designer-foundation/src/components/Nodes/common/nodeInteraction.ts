// Utilities to prevent ReactFlow interactions from interfering with inputs.
export const createStopNodeInteraction = () => ({
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
  },
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
    e.stopPropagation();
  },
  className: "nodrag nowheel",
  inputProps: {
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      e.stopPropagation();
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => {
      e.stopPropagation();
    },
  },
});
