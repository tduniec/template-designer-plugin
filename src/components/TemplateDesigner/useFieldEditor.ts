import { useCallback, useEffect, useRef, useState } from "react";

type EditorState = null | {
  target: HTMLInputElement | HTMLTextAreaElement;
  label: string;
};

const resolveLabel = (element: HTMLInputElement | HTMLTextAreaElement) =>
  element.getAttribute("aria-label") ??
  element.name ??
  element.placeholder ??
  "Field editor";

/**
 * Provides a modal-friendly editing experience for readonly-looking inputs
 * by letting users double-click any text field and edit its value centrally.
 */
export const useFieldEditor = () => {
  const [editorState, setEditorState] = useState<EditorState>(null);
  const [editorValue, setEditorValue] = useState("");
  const interactionRootRef = useRef<HTMLDivElement | null>(null);

  const closeEditor = useCallback(() => {
    setEditorState(null);
    setEditorValue("");
  }, []);

  const applyEditorValue = useCallback(() => {
    const current = editorState;
    if (!current) {
      return;
    }

    const setNativeValue = (
      element: HTMLInputElement | HTMLTextAreaElement,
      value: string
    ) => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        element,
        "value"
      )?.set;
      const prototype = Object.getPrototypeOf(element);
      const prototypeValueSetter = Object.getOwnPropertyDescriptor(
        prototype,
        "value"
      )?.set;

      if (valueSetter && valueSetter !== prototypeValueSetter) {
        prototypeValueSetter?.call(element, value);
      } else if (valueSetter) {
        valueSetter.call(element, value);
      } else {
        // eslint-disable-next-line no-param-reassign
        element.value = value;
      }
    };

    setNativeValue(current.target, editorValue);
    current.target.dispatchEvent(new Event("input", { bubbles: true }));
    closeEditor();
  }, [closeEditor, editorState, editorValue]);

  const openEditor = useCallback(
    (target: HTMLInputElement | HTMLTextAreaElement) => {
      setEditorState({
        target,
        label: resolveLabel(target),
      });
      setEditorValue(target.value);
    },
    []
  );

  useEffect(() => {
    const root = interactionRootRef.current;
    if (!root) {
      return undefined;
    }

    const handleDoubleClick = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement &&
        !target.readOnly &&
        !target.disabled
      ) {
        const type = target.type?.toLowerCase();
        const editableTypes = [
          "text",
          "search",
          "url",
          "tel",
          "email",
          "number",
          "password",
        ];
        const isTextual = !type || editableTypes.includes(type);
        if (!isTextual || !target.value) {
          return;
        }
        event.stopPropagation();
        openEditor(target);
        return;
      }
      if (
        target instanceof HTMLTextAreaElement &&
        !target.readOnly &&
        !target.disabled &&
        target.value
      ) {
        event.stopPropagation();
        openEditor(target);
      }
    };

    root.addEventListener("dblclick", handleDoubleClick, true);
    return () => {
      root.removeEventListener("dblclick", handleDoubleClick, true);
    };
  }, [openEditor]);

  return {
    editorState,
    editorValue,
    setEditorValue,
    interactionRootRef,
    closeEditor,
    applyEditorValue,
  };
};
