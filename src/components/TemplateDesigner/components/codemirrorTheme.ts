import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { Theme } from "@material-ui/core/styles";

export const createCodeMirrorTheme = (
  materialTheme: Theme,
  paletteMode: "light" | "dark"
): Extension =>
  EditorView.theme(
    {
      "&": {
        backgroundColor: materialTheme.palette.background.paper,
        color: materialTheme.palette.text.primary,
      },
      ".cm-content": {
        fontFamily: '"Roboto Mono", "SFMono-Regular", Consolas, monospace',
      },
      ".cm-scroller": {
        fontSize: 13,
        lineHeight: 1.5,
      },
      ".cm-gutters": {
        backgroundColor: materialTheme.palette.background.paper,
        color: materialTheme.palette.text.secondary,
        borderRight: `1px solid ${materialTheme.palette.divider}`,
      },
      "&.cm-editor.cm-focused": {
        outline: `1px solid ${materialTheme.palette.primary.main}`,
        outlineOffset: 0,
      },
    },
    { dark: paletteMode === "dark" }
  );
