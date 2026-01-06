import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import type { Theme } from "@material-ui/core/styles";

export const TEMPLATE_DESIGNER_CM_CLASS = "td-template-cm";

/**
 * Creates an isolated CodeMirror theme that only applies to editors with the
 * TEMPLATE_DESIGNER_CM_CLASS class to avoid leaking styles to other editors in
 * the host Backstage app.
 */
export const createCodeMirrorTheme = (
  materialTheme: Theme,
  paletteMode: "light" | "dark"
): Extension =>
  EditorView.theme(
    {
      [`&.${TEMPLATE_DESIGNER_CM_CLASS}`]: {
        backgroundColor: materialTheme.palette.background.paper,
        color: materialTheme.palette.text.primary,
      },
      [`.${TEMPLATE_DESIGNER_CM_CLASS} .cm-content`]: {
        fontFamily: '"Roboto Mono", "SFMono-Regular", Consolas, monospace',
      },
      [`.${TEMPLATE_DESIGNER_CM_CLASS} .cm-scroller`]: {
        fontSize: 13,
        lineHeight: 1.5,
      },
      [`.${TEMPLATE_DESIGNER_CM_CLASS} .cm-gutters`]: {
        backgroundColor: materialTheme.palette.background.paper,
        color: materialTheme.palette.text.secondary,
        borderRight: `1px solid ${materialTheme.palette.divider}`,
      },
      [`&.${TEMPLATE_DESIGNER_CM_CLASS}.cm-editor.cm-focused`]: {
        outline: `1px solid ${materialTheme.palette.primary.main}`,
        outlineOffset: 0,
      },
    },
    { dark: paletteMode === "dark" }
  );
