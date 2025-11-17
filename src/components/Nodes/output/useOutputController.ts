import { useCallback, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import type { OutputNodeData } from "../types";

const BUILTIN_KEYS = new Set(["links", "text"]);

type LinkField = "title" | "icon" | "url" | "entityRef";
type TextField = "title" | "icon" | "content";

type UpdateFn<T> = (index: number, field: T, value: string) => void;

export const useOutputController = (data: OutputNodeData) => {
  const { rfId, output } = data;
  const [newCustomKey, setNewCustomKey] = useState("");
  const [newCustomValue, setNewCustomValue] = useState("");

  const stepOutputReferences = useMemo(
    () => data.stepOutputReferences ?? [],
    [data.stepOutputReferences]
  );
  const referenceOptions = useMemo(
    () => Array.from(new Set(stepOutputReferences.filter(Boolean))),
    [stepOutputReferences]
  );

  const links = useMemo(
    () => (Array.isArray(output?.links) ? [...output.links] : []),
    [output?.links]
  );
  const textEntries = useMemo(
    () => (Array.isArray(output?.text) ? [...output.text] : []),
    [output?.text]
  );
  const customEntries = useMemo(() => {
    if (!output || typeof output !== "object") {
      return [] as Array<[string, unknown]>;
    }
    return Object.entries(output).filter(([key]) => !BUILTIN_KEYS.has(key));
  }, [output]);

  const updateOutput = useCallback(
    (
      updater: (prev: OutputNodeData["output"]) => OutputNodeData["output"]
    ): void => {
      data.onUpdateOutput?.(rfId, updater);
    },
    [data, rfId]
  );

  const handleCustomValueChange = useCallback(
    (key: string) => (event: ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value;
      updateOutput((prev) => ({
        ...(prev ?? {}),
        [key]: raw,
      }));
    },
    [updateOutput]
  );

  const handleRemoveCustom = useCallback(
    (key: string) => {
      updateOutput((prev) => {
        const next = { ...(prev ?? {}) };
        delete next[key];
        return next;
      });
    },
    [updateOutput]
  );

  const handleAddCustom = useCallback(() => {
    const trimmedKey = newCustomKey.trim();
    if (!trimmedKey || BUILTIN_KEYS.has(trimmedKey)) {
      return;
    }
    updateOutput((prev) => {
      if (prev && Object.prototype.hasOwnProperty.call(prev, trimmedKey)) {
        return prev;
      }
      return {
        ...(prev ?? {}),
        [trimmedKey]: newCustomValue,
      };
    });
    setNewCustomKey("");
    setNewCustomValue("");
  }, [newCustomKey, newCustomValue, updateOutput]);

  const setLinkFieldValue = useCallback<UpdateFn<LinkField>>(
    (index, field, value) => {
      const normalized = value ?? "";
      updateOutput((prev) => {
        const currentLinks = Array.isArray(prev?.links) ? [...prev.links] : [];
        const target = { ...(currentLinks[index] ?? {}) };
        target[field] = normalized;
        currentLinks[index] = target;
        return { ...(prev ?? {}), links: currentLinks };
      });
    },
    [updateOutput]
  );

  const handleLinkChange = useCallback(
    (index: number, field: LinkField) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        setLinkFieldValue(index, field, event.target.value);
      },
    [setLinkFieldValue]
  );

  const handleRemoveLink = useCallback(
    (index: number) => {
      updateOutput((prev) => {
        const currentLinks = Array.isArray(prev?.links) ? [...prev.links] : [];
        currentLinks.splice(index, 1);
        if (!currentLinks.length) {
          const { links: _omit, ...rest } = prev ?? {};
          return rest;
        }
        return { ...(prev ?? {}), links: currentLinks };
      });
    },
    [updateOutput]
  );

  const handleAddLink = useCallback(() => {
    updateOutput((prev) => {
      const currentLinks = Array.isArray(prev?.links) ? [...prev.links] : [];
      currentLinks.push({ title: "", url: "" });
      return { ...(prev ?? {}), links: currentLinks };
    });
  }, [updateOutput]);

  const setTextFieldValue = useCallback<UpdateFn<TextField>>(
    (index, field, value) => {
      const normalized = value ?? "";
      updateOutput((prev) => {
        const currentText = Array.isArray(prev?.text) ? [...prev.text] : [];
        const target = { ...(currentText[index] ?? {}) };
        target[field] = normalized;
        currentText[index] = target;
        return { ...(prev ?? {}), text: currentText };
      });
    },
    [updateOutput]
  );

  const handleTextChange = useCallback(
    (index: number, field: TextField) =>
      (event: ChangeEvent<HTMLInputElement>) => {
        setTextFieldValue(index, field, event.target.value);
      },
    [setTextFieldValue]
  );

  const handleTextDefaultToggle = useCallback(
    (index: number) => {
      updateOutput((prev) => {
        const currentText = Array.isArray(prev?.text) ? [...prev.text] : [];
        const target = { ...(currentText[index] ?? {}) };
        target.default = !target.default;
        currentText[index] = target;
        return { ...(prev ?? {}), text: currentText };
      });
    },
    [updateOutput]
  );

  const handleRemoveText = useCallback(
    (index: number) => {
      updateOutput((prev) => {
        const currentText = Array.isArray(prev?.text) ? [...prev.text] : [];
        currentText.splice(index, 1);
        if (!currentText.length) {
          const { text: _omit, ...rest } = prev ?? {};
          return rest;
        }
        return { ...(prev ?? {}), text: currentText };
      });
    },
    [updateOutput]
  );

  const handleAddText = useCallback(() => {
    updateOutput((prev) => {
      const currentText = Array.isArray(prev?.text) ? [...prev.text] : [];
      currentText.push({ title: "", content: "" });
      return { ...(prev ?? {}), text: currentText };
    });
  }, [updateOutput]);

  return {
    stepOutputReferences,
    referenceOptions,
    links,
    textEntries,
    customEntries,
    newCustomKey,
    setNewCustomKey,
    newCustomValue,
    setNewCustomValue,
    handleAddCustom,
    handleCustomValueChange,
    handleRemoveCustom,
    setLinkFieldValue,
    handleLinkChange,
    handleAddLink,
    handleRemoveLink,
    setTextFieldValue,
    handleTextChange,
    handleTextDefaultToggle,
    handleAddText,
    handleRemoveText,
  };
};
